import { Icon } from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface JourneyChapter {
  id: string;
  chapter_number: number;
  title: string;
  subtitle?: string;
  era_label?: string;
  description?: string;
  cover_url?: string;
  series_id?: string;
  is_published: boolean;
  show_coming_soon: boolean;
  estimated_release?: string;
  order_index: number;
  episode_count?: number;
}

interface ChapterProgress {
  chapter_id: string;
  progress_pct: number;
  completed: boolean;
}

export default function JourneyScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { nowPlaying } = useAudio();
  const { user } = useAuth();
  const isWeb = Platform.OS === "web";
  const hasMiniplayer = !!nowPlaying;

  const [chapters, setChapters] = useState<JourneyChapter[]>([]);
  const [progress, setProgress] = useState<Record<string, ChapterProgress>>({});
  const [loading, setLoading] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: chaptersData }, { data: progressData }] = await Promise.all([
        supabase
          .from("journey_chapters")
          .select("*")
          .eq("is_published", true)
          .order("order_index"),
        user?.id
          ? supabase
              .from("journey_progress")
              .select("chapter_id, progress_pct, completed")
              .eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
      ]);

      setChapters(chaptersData ?? []);

      const progressMap: Record<string, ChapterProgress> = {};
      (progressData ?? []).forEach((p: ChapterProgress) => {
        progressMap[p.chapter_id] = p;
      });
      setProgress(progressMap);
    } catch (err) {
      console.warn("Journey fetch error:", err);
      setChapters([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalChapters = chapters.length;
  const completedCount = chapters.filter(c => progress[c.id]?.completed).length;
  const overallPct = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0;
  const allDone = totalChapters > 0 && completedCount === totalChapters;

  const currentChapter = allDone
    ? null
    : chapters.find(c => !progress[c.id]?.completed && c.series_id) ?? chapters[0];

  function getCtaLabel() {
    if (allDone) return "Restart the Journey";
    if (completedCount === 0) return "Start from the Beginning";
    return `Continue — Chapter ${currentChapter?.chapter_number}`;
  }

  function getCtaIcon() {
    if (allDone) return "refresh-cw";
    return "play";
  }

  function handleCta() {
    if (allDone) {
      const first = chapters[0];
      if (first?.series_id) router.push(`/series/${first.series_id}`);
      return;
    }
    if (currentChapter?.series_id) router.push(`/series/${currentChapter.series_id}`);
  }

  function getChapterStatus(chapter: JourneyChapter): "done" | "current" | "idle" {
    const p = progress[chapter.id];
    if (p?.completed) return "done";
    if (p && p.progress_pct > 0) return "current";
    if (chapter.id === currentChapter?.id && completedCount > 0) return "current";
    return "idle";
  }

  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Fixed header ── */}
      <LinearGradient
        colors={[colors.gold + "55", colors.gold + "11", colors.background]}
        style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 14 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <View style={[styles.backBtnInner, { backgroundColor: "rgba(0,0,0,0.28)" }]}>
            <Icon name="arrow-left" size={20} color="#fff" />
          </View>
        </Pressable>

        <Text style={[styles.label, { color: colors.goldLight }]}>THE COMPLETE STORY</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Journey Through Islam</Text>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {loading
            ? "Loading journey..."
            : completedCount > 0
            ? `${completedCount}/${totalChapters} chapters complete`
            : `${totalChapters} chapters · From Creation to the Khulafa Rashidun`}
        </Text>

        {/* Progress bar (only if user has started) */}
        {!loading && completedCount > 0 && totalChapters > 0 && (
          <View style={styles.progressBarWrap}>
            <View style={[styles.progressBarBg, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${overallPct}%`,
                    backgroundColor: allDone ? colors.green : colors.gold,
                    opacity: shimmerOpacity,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressPct, { color: colors.goldLight }]}>
              {allDone ? "✓ Complete!" : `${overallPct}%`}
            </Text>
          </View>
        )}

        {/* CTA button with pulse animation */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            onPress={handleCta}
            disabled={loading || chapters.length === 0}
            style={[
              styles.ctaBtn,
              {
                backgroundColor: allDone ? colors.green : colors.gold,
                opacity: loading || chapters.length === 0 ? 0.5 : 1,
              },
            ]}
          >
            <Icon name={getCtaIcon()} size={16} color="#fff" />
            <Text style={styles.ctaBtnText}>{getCtaLabel()}</Text>
          </Pressable>
        </Animated.View>
      </LinearGradient>

      {/* ── Scrollable chapters list ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.gold} size="large" />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading chapters...</Text>
          </View>
        ) : chapters.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="book-open" size={36} color={colors.textMuted} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>No chapters published yet</Text>
            <Text style={[styles.loadingSubtext, { color: colors.textMuted }]}>Check back soon!</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {chapters.map((chapter, idx) => {
              const isLast = idx === chapters.length - 1;
              const status = getChapterStatus(chapter);
              const chapterProgress = progress[chapter.id];
              const isCurrent = status === "current";
              const isDone = status === "done";
              const pct = chapterProgress?.progress_pct ?? 0;

              return (
                <View key={chapter.id} style={styles.chapterRow}>
                  {/* Timeline column */}
                  <View style={styles.timelineCol}>
                    <View
                      style={[
                        styles.timelineDot,
                        isDone && { backgroundColor: colors.green, borderColor: colors.green },
                        isCurrent && { backgroundColor: colors.gold + "22", borderColor: colors.gold },
                        !isDone && !isCurrent && { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      {isDone ? (
                        <Icon name="check" size={13} color="#fff" />
                      ) : (
                        <Text
                          style={[
                            styles.dotNum,
                            {
                              color: isCurrent ? colors.gold : colors.textMuted,
                              fontWeight: isCurrent ? "700" : "600",
                            },
                          ]}
                        >
                          {chapter.chapter_number}
                        </Text>
                      )}
                    </View>
                    {!isLast && (
                      <View
                        style={[
                          styles.timelineLine,
                          { backgroundColor: isDone ? colors.green + "66" : colors.border },
                        ]}
                      />
                    )}
                  </View>

                  {/* Chapter card */}
                  <Pressable
                    onPress={() => chapter.series_id && router.push(`/series/${chapter.series_id}`)}
                    style={({ pressed }) => [
                      styles.chapterCard,
                      {
                        backgroundColor: pressed
                          ? colors.surfaceHigh
                          : isCurrent
                          ? colors.gold + "0D"
                          : isDone
                          ? colors.surface
                          : colors.surface,
                        borderColor: isCurrent
                          ? colors.gold + "55"
                          : isDone
                          ? colors.green + "44"
                          : colors.border,
                      },
                    ]}
                  >
                    {/* Top row: era + episode count */}
                    <View style={styles.chapterTop}>
                      <View style={styles.chapterTitles}>
                        {chapter.era_label && (
                          <Text style={[styles.chapterEra, { color: isCurrent ? colors.gold : colors.goldLight }]}>
                            {chapter.era_label}
                          </Text>
                        )}
                        <Text
                          style={[
                            styles.chapterTitle,
                            {
                              color: isDone
                                ? colors.textSecondary
                                : isCurrent
                                ? colors.textPrimary
                                : colors.textPrimary,
                            },
                          ]}
                        >
                          {chapter.title}
                        </Text>
                      </View>

                      {/* Status badge */}
                      {isDone ? (
                        <View style={[styles.statusBadge, { backgroundColor: colors.green + "22", borderColor: colors.green + "44" }]}>
                          <Icon name="check-circle" size={11} color={colors.green} />
                          <Text style={[styles.statusBadgeText, { color: colors.green }]}>Done</Text>
                        </View>
                      ) : isCurrent ? (
                        <View style={[styles.statusBadge, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "44" }]}>
                          <Icon name="play-circle" size={11} color={colors.gold} />
                          <Text style={[styles.statusBadgeText, { color: colors.gold }]}>In Progress</Text>
                        </View>
                      ) : (chapter.episode_count ?? 0) > 0 ? (
                        <Text style={[styles.chapterEps, { color: colors.textMuted }]}>
                          {chapter.episode_count} eps
                        </Text>
                      ) : null}
                    </View>

                    {/* Description */}
                    {chapter.description && (
                      <Text style={[styles.chapterDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {chapter.description}
                      </Text>
                    )}

                    {/* Progress bar (in-progress chapters) */}
                    {isCurrent && pct > 0 && (
                      <View style={styles.chapterProgressWrap}>
                        <View style={[styles.chapterProgressBg, { backgroundColor: colors.divider }]}>
                          <View
                            style={[styles.chapterProgressFill, { width: `${pct}%`, backgroundColor: colors.gold }]}
                          />
                        </View>
                        <Text style={[styles.chapterProgressPct, { color: colors.gold }]}>{pct}%</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 6,
  },
  backBtn: {
    marginBottom: 6,
    alignSelf: "flex-start",
  },
  backBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  progressBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: "700",
    minWidth: 52,
    textAlign: "right",
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    marginTop: 8,
    shadowColor: "#C8963E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 70,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "600",
  },
  loadingSubtext: {
    fontSize: 13,
  },
  timeline: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  chapterRow: {
    flexDirection: "row",
    gap: 12,
    minHeight: 80,
  },
  timelineCol: {
    alignItems: "center",
    width: 34,
    paddingTop: 4,
  },
  timelineDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  dotNum: {
    fontSize: 12,
    fontWeight: "600",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -4,
    borderRadius: 1,
  },
  chapterCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    marginBottom: 10,
    gap: 5,
  },
  chapterTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  chapterTitles: {
    flex: 1,
    gap: 2,
  },
  chapterEra: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  chapterTitle: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  chapterEps: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  chapterDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  chapterProgressWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  chapterProgressBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  chapterProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  chapterProgressPct: {
    fontSize: 10,
    fontWeight: "700",
    minWidth: 28,
    textAlign: "right",
  },
  comingSoon: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});
