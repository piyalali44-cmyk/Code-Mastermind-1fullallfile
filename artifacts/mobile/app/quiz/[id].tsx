import { Icon } from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";
import { addXp } from "@/lib/db";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  sort_order: number;
}

interface QuizMeta {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  pass_percentage: number;
  xp_reward: number;
}

type Phase = "loading" | "intro" | "question" | "result";

export default function QuizTakeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isGuest, applyXpBonus } = useAuth();
  const isWeb = Platform.OS === "web";

  const [phase, setPhase] = useState<Phase>("loading");
  const [quiz, setQuiz] = useState<QuizMeta | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(false);

  const loadQuiz = useCallback(async () => {
    if (!id) return;
    try {
      const [{ data: qz }, { data: qs }] = await Promise.all([
        supabase.from("quizzes").select("id, title, description, category, pass_percentage, xp_reward").eq("id", id).eq("is_active", true).single(),
        supabase.from("quiz_questions").select("*").eq("quiz_id", id).order("sort_order"),
      ]);
      if (!qz || !qs || qs.length === 0) {
        setPhase("intro");
        return;
      }
      setQuiz(qz as QuizMeta);
      setQuestions(qs as Question[]);
      setAnswers(new Array(qs.length).fill(null));
      if (user?.id) {
        const { data: priorPass } = await supabase
          .from("quiz_attempts")
          .select("id")
          .eq("user_id", user.id)
          .eq("quiz_id", id)
          .eq("passed", true)
          .limit(1);
        if (priorPass && priorPass.length > 0) {
          setXpAwarded(true);
        }
      }
      setPhase("intro");
    } catch (err) {
      console.warn("[QuizTake] load error:", err);
      setPhase("intro");
    }
  }, [id]);

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  const startQuiz = () => {
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setConfirmed(false);
    setPhase("question");
  };

  const confirmAnswer = () => {
    if (selectedAnswer === null) return;
    const newAnswers = [...answers];
    newAnswers[currentIdx] = selectedAnswer;
    setAnswers(newAnswers);
    setConfirmed(true);
  };

  const nextQuestion = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedAnswer(null);
      setConfirmed(false);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    if (!quiz || !user) return;
    const correct = answers.reduce<number>((count, ans, idx) => {
      if (ans === questions[idx]?.correct_index) return count + 1;
      return count;
    }, 0);
    const pct = Math.round((correct / questions.length) * 100);
    const didPass = pct >= quiz.pass_percentage;

    setScore(correct);
    setPassed(didPass);
    setPhase("result");

    try {
      await supabase.from("quiz_attempts").insert({
        user_id: user.id,
        quiz_id: quiz.id,
        score: correct,
        total_questions: questions.length,
        percentage: pct,
        passed: didPass,
      });
    } catch (err) {
      console.warn("[QuizTake] save attempt:", err);
    }

    if (didPass && !xpAwarded) {
      setXpAwarded(true);
      try {
        await addXp(user.id, quiz.xp_reward, `quiz_pass:${quiz.id}`);
        applyXpBonus(quiz.xp_reward);
      } catch (err) {
        console.warn("[QuizTake] award XP:", err);
      }
    }
  };

  const retryQuiz = () => {
    setAnswers(new Array(questions.length).fill(null));
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setConfirmed(false);
    setScore(0);
    setPassed(false);
    setPhase("question");
  };

  const currentQ = questions[currentIdx];

  if (isGuest) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <View style={{ paddingTop: insets.top }} />
        <Icon name="lock" size={48} color={colors.gold} />
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginTop: 16, textAlign: "center" }}>
          Sign in to take quizzes
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: "center" }}>
          Create a free account to track your progress and earn XP.
        </Text>
        <Pressable
          onPress={() => router.replace("/login")}
          style={{ marginTop: 24, backgroundColor: colors.gold, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>Sign In</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0), borderBottomColor: colors.divider }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Icon name="arrow-left" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {quiz?.title ?? "Quiz"}
          </Text>
          {phase === "question" ? (
            <Text style={[styles.progress, { color: colors.textMuted }]}>
              {currentIdx + 1}/{questions.length}
            </Text>
          ) : <View style={{ width: 40 }} />}
        </View>
        {phase === "question" && (
          <View style={[styles.progressBar, { backgroundColor: colors.surfaceHigh }]}>
            <View style={[styles.progressFill, {
              backgroundColor: colors.gold,
              width: `${((currentIdx + (confirmed ? 1 : 0)) / questions.length) * 100}%`,
            }]} />
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 80 + insets.bottom, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {phase === "loading" && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.goldLight} />
          </View>
        )}

        {phase === "intro" && quiz && (
          <View style={styles.introContainer}>
            <View style={[styles.introIcon, { backgroundColor: colors.gold + "22" }]}>
              <Icon name="help-circle" size={48} color={colors.goldLight} />
            </View>
            <Text style={[styles.introTitle, { color: colors.textPrimary }]}>{quiz.title}</Text>
            {quiz.description && (
              <Text style={[styles.introDesc, { color: colors.textSecondary }]}>{quiz.description}</Text>
            )}
            <View style={[styles.infoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.infoItem}>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{questions.length}</Text>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Questions</Text>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.infoItem}>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{quiz.pass_percentage}%</Text>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>To Pass</Text>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.infoItem}>
                <Text style={[styles.infoValue, { color: colors.goldLight }]}>+{quiz.xp_reward}</Text>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>XP Reward</Text>
              </View>
            </View>
            <Pressable onPress={startQuiz} style={[styles.startBtn, { backgroundColor: colors.gold }]}>
              <Text style={styles.startBtnText}>Start Quiz</Text>
            </Pressable>
          </View>
        )}

        {phase === "intro" && !quiz && !questions.length && (
          <View style={styles.center}>
            <Icon name="alert-circle" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Quiz not found</Text>
          </View>
        )}

        {phase === "question" && currentQ && (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionText, { color: colors.textPrimary }]}>{currentQ.question}</Text>

            <View style={{ gap: 10, marginTop: 20 }}>
              {currentQ.options.map((opt, idx) => {
                if (!opt.trim()) return null;
                const isSelected = selectedAnswer === idx;
                const isCorrect = idx === currentQ.correct_index;
                let borderColor = colors.border;
                let bg = colors.surface;
                let iconName: string | null = null;
                let iconColor = colors.textMuted;

                if (confirmed) {
                  if (isCorrect) {
                    borderColor = colors.green;
                    bg = colors.green + "15";
                    iconName = "check-circle";
                    iconColor = colors.green;
                  } else if (isSelected && !isCorrect) {
                    borderColor = colors.error;
                    bg = colors.error + "15";
                    iconName = "x-circle";
                    iconColor = colors.error;
                  }
                } else if (isSelected) {
                  borderColor = colors.gold;
                  bg = colors.gold + "15";
                }

                return (
                  <Pressable
                    key={idx}
                    onPress={() => !confirmed && setSelectedAnswer(idx)}
                    disabled={confirmed}
                    style={[styles.optionBtn, { backgroundColor: bg, borderColor }]}
                  >
                    <View style={[styles.optionCircle, {
                      borderColor: confirmed ? "transparent" : (isSelected ? colors.gold : colors.border),
                      backgroundColor: isSelected && !confirmed ? colors.gold : "transparent",
                    }]}>
                      {isSelected && !confirmed && <View style={styles.optionDot} />}
                      {confirmed && iconName && <Icon name={iconName} size={18} color={iconColor} />}
                    </View>
                    <Text style={[styles.optionText, { color: colors.textPrimary }]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>

            {confirmed && currentQ.explanation && (
              <View style={[styles.explanationBox, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                <Text style={[styles.explanationLabel, { color: colors.goldLight }]}>Explanation</Text>
                <Text style={[styles.explanationText, { color: colors.textSecondary }]}>{currentQ.explanation}</Text>
              </View>
            )}

            <View style={{ marginTop: 24 }}>
              {!confirmed ? (
                <Pressable
                  onPress={confirmAnswer}
                  disabled={selectedAnswer === null}
                  style={[styles.startBtn, {
                    backgroundColor: selectedAnswer !== null ? colors.gold : colors.surfaceHigh,
                    opacity: selectedAnswer !== null ? 1 : 0.5,
                  }]}
                >
                  <Text style={[styles.startBtnText, { color: selectedAnswer !== null ? "#fff" : colors.textMuted }]}>
                    Confirm Answer
                  </Text>
                </Pressable>
              ) : (
                <Pressable onPress={nextQuestion} style={[styles.startBtn, { backgroundColor: colors.gold }]}>
                  <Text style={styles.startBtnText}>
                    {currentIdx < questions.length - 1 ? "Next Question" : "See Results"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {phase === "result" && quiz && (
          <View style={styles.resultContainer}>
            <View style={[styles.resultIcon, { backgroundColor: passed ? colors.green + "22" : colors.error + "22" }]}>
              <Icon name={passed ? "award" : "refresh-cw"} size={48} color={passed ? colors.green : colors.error} />
            </View>
            <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>
              {passed ? "Congratulations!" : "Keep Learning!"}
            </Text>
            <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
              {passed
                ? `You passed with ${score}/${questions.length} correct answers.`
                : `You got ${score}/${questions.length} correct. You need ${quiz.pass_percentage}% to pass.`}
            </Text>

            <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.scorePct, { color: passed ? colors.green : colors.error }]}>
                {Math.round((score / questions.length) * 100)}%
              </Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Score</Text>
            </View>

            {passed && xpAwarded && (
              <View style={[styles.xpReward, { backgroundColor: colors.gold + "15", borderColor: colors.gold + "33" }]}>
                <Icon name="zap" size={20} color={colors.goldLight} />
                <Text style={[styles.xpRewardText, { color: colors.goldLight }]}>+{quiz.xp_reward} XP earned!</Text>
              </View>
            )}

            <View style={{ gap: 12, marginTop: 24, width: "100%" }}>
              {!passed && (
                <Pressable onPress={retryQuiz} style={[styles.startBtn, { backgroundColor: colors.gold }]}>
                  <Text style={styles.startBtnText}>Try Again</Text>
                </Pressable>
              )}
              <Pressable onPress={() => router.back()} style={[styles.outlineBtn, { borderColor: colors.border }]}>
                <Text style={[styles.outlineBtnText, { color: colors.textPrimary }]}>
                  {passed ? "Done" : "Back to Quizzes"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", flex: 1, textAlign: "center", marginHorizontal: 8 },
  progress: { fontSize: 13, fontWeight: "600", width: 40, textAlign: "right" },
  progressBar: { height: 4, borderRadius: 2, marginTop: 4 },
  progressFill: { height: 4, borderRadius: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 100, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  introContainer: { alignItems: "center", paddingTop: 40, gap: 16 },
  introIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  introTitle: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  introDesc: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 300 },
  infoRow: { flexDirection: "row", borderRadius: 14, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 12, marginTop: 8, width: "100%" },
  infoItem: { flex: 1, alignItems: "center", gap: 4 },
  infoValue: { fontSize: 18, fontWeight: "800" },
  infoLabel: { fontSize: 11, fontWeight: "500" },
  infoDivider: { width: 1, alignSelf: "stretch" },
  startBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center", width: "100%" },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  questionContainer: { flex: 1 },
  questionText: { fontSize: 17, fontWeight: "700", lineHeight: 24 },
  optionBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  optionCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  optionDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff" },
  optionText: { fontSize: 15, flex: 1, lineHeight: 20 },
  explanationBox: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1 },
  explanationLabel: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  explanationText: { fontSize: 13, lineHeight: 18 },
  resultContainer: { alignItems: "center", paddingTop: 40, gap: 12 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  resultTitle: { fontSize: 24, fontWeight: "800" },
  resultSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 300 },
  scoreCard: { paddingVertical: 20, paddingHorizontal: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", marginTop: 8 },
  scorePct: { fontSize: 40, fontWeight: "800" },
  scoreLabel: { fontSize: 13, fontWeight: "500", marginTop: 4 },
  xpReward: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  xpRewardText: { fontSize: 15, fontWeight: "700" },
  outlineBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center", borderWidth: 1.5, width: "100%" },
  outlineBtnText: { fontWeight: "700", fontSize: 16 },
});
