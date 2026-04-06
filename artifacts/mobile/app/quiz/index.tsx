import { Icon } from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useAudio } from "@/context/AudioContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  pass_percentage: number;
  xp_reward: number;
  question_count: number;
}

export default function QuizListScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isGuest } = useAuth();
  const { nowPlaying } = useAudio();
  const isWeb = Platform.OS === "web";
  const hasMiniplayer = !!nowPlaying;

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("quizzes")
        .select("id, title, description, category, pass_percentage, xp_reward")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        setQuizzes([]);
        setLoading(false);
        return;
      }

      const { data: qData } = await supabase
        .from("quiz_questions")
        .select("quiz_id");
      const counts: Record<string, number> = {};
      (qData ?? []).forEach((q: any) => {
        counts[q.quiz_id] = (counts[q.quiz_id] ?? 0) + 1;
      });

      setQuizzes(
        (data as any[])
          .filter((q) => (counts[q.id] ?? 0) > 0)
          .map((q) => ({ ...q, question_count: counts[q.id] ?? 0 }))
      );

      if (user?.id) {
        const { data: attempts } = await supabase
          .from("quiz_attempts")
          .select("quiz_id")
          .eq("user_id", user.id)
          .eq("passed", true);
        setCompletedIds(new Set((attempts ?? []).map((a: any) => a.quiz_id)));
      }
    } catch (err) {
      console.warn("[QuizList] load error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadQuizzes(); }, [loadQuizzes]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0), borderBottomColor: colors.divider }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Icon name="arrow-left" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Quizzes</Text>
          <View style={{ width: 22 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {isGuest ? (
          <View style={styles.emptyState}>
            <Icon name="log-in" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sign in to take quizzes</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Test your Islamic knowledge and earn XP by completing quizzes.
            </Text>
            <Pressable onPress={() => router.push("/login")} style={[styles.actionBtn, { backgroundColor: colors.gold }]}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Sign In</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.goldLight} />
          </View>
        ) : quizzes.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="help-circle" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No quizzes available</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Check back later for new quizzes to test your knowledge.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {quizzes.length} quiz{quizzes.length !== 1 ? "zes" : ""} available
            </Text>
            {quizzes.map((quiz) => {
              const completed = completedIds.has(quiz.id);
              return (
                <Pressable
                  key={quiz.id}
                  onPress={() => router.push(`/quiz/${quiz.id}` as any)}
                  style={[styles.card, {
                    backgroundColor: colors.surface,
                    borderColor: completed ? colors.green + "44" : colors.border,
                  }]}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.iconCircle, { backgroundColor: completed ? colors.green + "22" : colors.gold + "22" }]}>
                      <Icon name={completed ? "check-circle" : "help-circle"} size={20} color={completed ? colors.green : colors.goldLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{quiz.title}</Text>
                      {quiz.category && (
                        <Text style={[styles.cardCategory, { color: colors.goldLight }]}>{quiz.category}</Text>
                      )}
                    </View>
                    <View style={[styles.xpBadge, { backgroundColor: colors.gold + "22" }]}>
                      <Text style={[styles.xpText, { color: colors.goldLight }]}>+{quiz.xp_reward} XP</Text>
                    </View>
                  </View>
                  {quiz.description && (
                    <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>{quiz.description}</Text>
                  )}
                  <View style={styles.cardMeta}>
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>
                      {quiz.question_count} question{quiz.question_count !== 1 ? "s" : ""} · Pass: {quiz.pass_percentage}%
                    </Text>
                    {completed && (
                      <Text style={[styles.metaText, { color: colors.green }]}>Passed</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  actionBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  subtitle: { fontSize: 13, marginBottom: 4 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardCategory: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaText: { fontSize: 12 },
  xpBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  xpText: { fontSize: 12, fontWeight: "700" },
});
