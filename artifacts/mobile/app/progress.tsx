import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useAudio } from "@/context/AudioContext";
import { checkAndAwardBadges, getEarnedBadgeSlugs, getHeatmapActivity, getJourneyCompletion, getWeeklyListeningMinutes } from "@/lib/db";
import { useColors } from "@/hooks/useColors";

const BADGE_DEFS = [
  { slug: "first_listen",  icon: "headphones", name: "First Listen",        desc: "First completed session" },
  { slug: "quran_start",   icon: "book-open",  name: "Quran Begins",        desc: "First surah listened" },
  { slug: "hadith_start",  icon: "file-text",  name: "Hadith Seeker",       desc: "First hadith listened" },
  { slug: "streak_3",      icon: "flame",      name: "3-Day Streak",        desc: "3 days in a row" },
  { slug: "streak_7",      icon: "zap",        name: "Week Warrior",        desc: "7 days in a row" },
  { slug: "streak_30",     icon: "trophy",     name: "Month Master",        desc: "30 days in a row" },
  { slug: "journey_start", icon: "map",        name: "Journey Begins",      desc: "Started the Journey" },
  { slug: "level_5",       icon: "star",       name: "Rising Scholar",      desc: "Reached Level 5" },
  { slug: "level_10",      icon: "award",      name: "Dedicated Learner",   desc: "Reached Level 10" },
  { slug: "hadith_10",     icon: "bookmark",   name: "Hadith Student",      desc: "10 hadith completed" },
  { slug: "hadith_40",     icon: "shield",     name: "Hadith Scholar",      desc: "40 hadith completed" },
  { slug: "quran_complete",icon: "book-open",  name: "Khatam",              desc: "All 114 surahs done" },
] as const;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export default function ProgressScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { nowPlaying } = useAudio();
  const isWeb = Platform.OS === "web";
  const hasMiniplayer = !!nowPlaying;

  const [earnedSlugs, setEarnedSlugs]     = useState<Set<string>>(new Set());
  const [weekMins, setWeekMins]           = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [heatmap, setHeatmap]             = useState<number[]>(Array(35).fill(0));
  const [journey, setJourney]             = useState({ completedChapters: 0, totalChapters: 20, currentChapter: 1, pct: 0 });
  const [statsLoading, setStatsLoading]   = useState(true);

  const loadStats = useCallback(async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      await checkAndAwardBadges(user.id);
      const [slugs, mins, heat, jour] = await Promise.all([
        getEarnedBadgeSlugs(user.id),
        getWeeklyListeningMinutes(user.id),
        getHeatmapActivity(user.id, 35),
        getJourneyCompletion(user.id),
      ]);
      setEarnedSlugs(new Set(slugs));
      setWeekMins(mins);
      setHeatmap(heat);
      setJourney(jour);
      refreshUser().catch(() => {});
    } catch { /* use defaults */ }
    finally { setStatsLoading(false); }
  }, [user?.id]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const xpToNextLevel = useMemo(() => {
    if (!user) return 500;
    const nextLevelXp = user.level * 500;
    return Math.max(0, nextLevelXp - user.xp);
  }, [user]);

  const xpProgress = useMemo(() => {
    if (!user) return 0;
    const floor = (user.level - 1) * 500;
    const ceil  = user.level * 500;
    return Math.min(100, Math.max(0, ((user.xp - floor) / (ceil - floor)) * 100));
  }, [user]);

  const maxBar = useMemo(() => Math.max(1, ...weekMins), [weekMins]);

  const levelTitle = useMemo(() => {
    if (!user) return "Seeker";
    return user.level >= 15 ? "Grand Sheikh"
      : user.level >= 10 ? "Sheikh"
      : user.level >= 7  ? "Hafiz"
      : user.level >= 5  ? "Scholar"
      : user.level >= 3  ? "Student"
      : "Seeker";
  }, [user]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 24, gap: 20 }}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
          <Icon name="bar-chart-2" size={40} color={colors.textMuted} />
        </View>
        <View style={{ alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>Track Your Progress</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 21 }}>
            Sign in to see your XP, streak, badges, and listening history.
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/login")}
          style={{ backgroundColor: colors.gold, paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 8, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surfaceHigh }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>My Progress</Text>
        <Pressable onPress={loadStats} style={[styles.backBtn, { backgroundColor: colors.surfaceHigh }]}>
          <Icon name="refresh-cw" size={16} color={colors.goldLight} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stats Row ── */}
        <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            { label: "Day Streak",   value: `${user.streak}`,                    icon: "flame" as const,      accent: "#F87171" },
            { label: "Total XP",     value: user.xp.toLocaleString(),             icon: "zap" as const,        accent: colors.goldLight },
            { label: "Best Streak",  value: `${user.longestStreak ?? user.streak}`, icon: "trophy" as const,   accent: "#10B981" },
            { label: "Level",        value: `${user.level}`,                      icon: "award" as const,      accent: "#818CF8" },
          ].map((stat, i) => (
            <View key={i} style={[styles.statItem, i < 3 && { borderRightColor: colors.divider, borderRightWidth: 0.5 }]}>
              <View style={[styles.statIconWrap, { backgroundColor: stat.accent + "20" }]}>
                <Icon name={stat.icon} size={14} color={stat.accent} />
              </View>
              <Text style={[styles.statNum, { color: stat.accent }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Level & XP ── */}
        <View style={[styles.levelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.levelHeader}>
            <View style={{ gap: 2 }}>
              <Text style={[styles.levelName, { color: colors.textPrimary }]}>{levelTitle}</Text>
              <Text style={[styles.levelSubtitle, { color: colors.textSecondary }]}>Level {user.level}</Text>
            </View>
            <View style={[styles.xpBadge, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "33" }]}>
              <Icon name="zap" size={13} color={colors.goldLight} />
              <Text style={[styles.xpText, { color: colors.goldLight }]}>{user.xp.toLocaleString()} XP</Text>
            </View>
          </View>
          <View>
            <View style={[styles.levelBarBg, { backgroundColor: colors.divider }]}>
              <View style={[styles.levelBarFill, { width: `${xpProgress}%`, backgroundColor: colors.gold }]} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
              <Text style={[styles.levelNote, { color: colors.textMuted }]}>Level {user.level}</Text>
              <Text style={[styles.levelNote, { color: colors.textMuted }]}>
                {xpToNextLevel > 0 ? `${xpToNextLevel} XP to Level ${user.level + 1}` : "Level up ready!"}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Streak Heatmap ── */}
        <View style={[styles.streakCard, { backgroundColor: colors.surface, borderColor: "#F87171" + "33" }]}>
          <View style={styles.streakTop}>
            <View style={[styles.streakIconWrap, { backgroundColor: "#F87171" + "20" }]}>
              <Icon name="flame" size={20} color="#F87171" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.streakNum, { color: colors.textPrimary }]}>{user.streak}-Day Streak</Text>
              <Text style={[styles.streakSub, { color: colors.textSecondary }]}>
                {user.streak > 0 ? "Keep it going — listen today!" : "Start your streak by listening today"}
              </Text>
            </View>
            {user.longestStreak > 0 && (
              <View style={[styles.bestBadge, { backgroundColor: colors.gold + "18" }]}>
                <Text style={{ color: colors.goldLight, fontSize: 11, fontWeight: "600" }}>Best: {user.longestStreak}</Text>
              </View>
            )}
          </View>
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.8 }}>LAST 5 WEEKS · ACTIVITY</Text>
            {statsLoading ? (
              <View style={{ height: 32, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="small" color={colors.goldLight} />
              </View>
            ) : (
              <View style={styles.heatmap}>
                {heatmap.map((intensity, i) => {
                  const bg = intensity > 0.75 ? colors.gold
                    : intensity > 0.45 ? colors.gold + "88"
                    : intensity > 0.15 ? colors.gold + "44"
                    : colors.divider;
                  return <View key={i} style={[styles.heatCell, { backgroundColor: bg }]} />;
                })}
              </View>
            )}
          </View>
        </View>

        {/* ── Weekly Chart ── */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>This Week</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>minutes listened</Text>
          </View>
          {statsLoading ? (
            <View style={{ height: 110, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator size="small" color={colors.gold} />
            </View>
          ) : (
            <View style={styles.chart}>
              {weekMins.map((mins, i) => {
                const today = (new Date().getDay() + 6) % 7; // 0 = Mon
                const isToday = i === today;
                return (
                  <View key={i} style={styles.barCol}>
                    {isToday && mins > 0 && (
                      <Text style={[styles.barMins, { color: colors.goldLight }]}>{mins}m</Text>
                    )}
                    <View style={[styles.barBg, { backgroundColor: colors.divider }]}>
                      <View style={[styles.barFill, {
                        height: `${(mins / maxBar) * 100}%`,
                        backgroundColor: isToday ? colors.gold : colors.gold + "55",
                      }]} />
                    </View>
                    <Text style={[styles.barDay, {
                      color: isToday ? colors.goldLight : colors.textMuted,
                      fontWeight: isToday ? "700" : "400",
                    }]}>
                      {DAYS[i]}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Journey Progress ── */}
        <View style={[styles.journeyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.journeyTop}>
            <View style={{ gap: 2 }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Islamic Journey</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>20-chapter guided path</Text>
            </View>
            <Pressable
              onPress={() => router.push("/journey")}
              style={[styles.viewAllBtn, { backgroundColor: colors.gold + "18" }]}
            >
              <Text style={[styles.viewAllText, { color: colors.goldLight }]}>View All</Text>
              <Icon name="arrow-right" size={13} color={colors.goldLight} />
            </Pressable>
          </View>
          {statsLoading ? (
            <ActivityIndicator size="small" color={colors.gold} />
          ) : (
            <View style={{ gap: 6 }}>
              <View style={[styles.journeyBarBg, { backgroundColor: colors.divider }]}>
                <View style={[styles.journeyBarFill, { width: `${journey.pct}%`, backgroundColor: colors.gold }]} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[styles.journeyNote, { color: colors.textSecondary }]}>
                  {journey.completedChapters === 0
                    ? "Not started yet"
                    : journey.completedChapters === journey.totalChapters
                    ? "Journey complete! 🎉"
                    : `Chapter ${journey.currentChapter} of ${journey.totalChapters} in progress`}
                </Text>
                <Text style={{ color: colors.goldLight, fontSize: 13, fontWeight: "600" }}>{journey.pct}%</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Quizzes ── */}
        <Pressable
          onPress={() => router.push("/quiz" as never)}
          style={[styles.journeyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.journeyTop}>
            <View style={{ gap: 2 }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Quizzes</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Test your knowledge and earn XP</Text>
            </View>
            <View style={[styles.viewAllBtn, { backgroundColor: colors.gold + "18" }]}>
              <Text style={[styles.viewAllText, { color: colors.goldLight }]}>Take Quiz</Text>
              <Icon name="arrow-right" size={13} color={colors.goldLight} />
            </View>
          </View>
        </Pressable>

        {/* ── Badges ── */}
        <View style={[styles.badgesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Badges</Text>
            {statsLoading ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {earnedSlugs.size}/{BADGE_DEFS.length} earned
              </Text>
            )}
          </View>
          <View style={styles.badgesGrid}>
            {BADGE_DEFS.map((badge) => {
              const earned = earnedSlugs.has(badge.slug);
              return (
                <View key={badge.slug} style={[styles.badgeItem, { opacity: earnedSlugs.size === 0 && statsLoading ? 0.4 : earned ? 1 : 0.35 }]}>
                  <View style={[styles.badgeIcon, {
                    backgroundColor: earned ? colors.gold + "28" : colors.surfaceHigh,
                    borderColor: earned ? colors.gold + "60" : colors.border,
                  }]}>
                    <Icon name={badge.icon as any} size={22} color={earned ? colors.goldLight : colors.textMuted} />
                  </View>
                  <Text style={[styles.badgeName, { color: earned ? colors.textPrimary : colors.textMuted }]} numberOfLines={2}>
                    {badge.name}
                  </Text>
                  <Text style={[styles.badgeDesc, { color: colors.textMuted }]} numberOfLines={2}>
                    {badge.desc}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700" },
  emptyIcon: { width: 90, height: 90, borderRadius: 45, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  statsCard: { borderRadius: 14, borderWidth: 1, flexDirection: "row", paddingVertical: 16, paddingHorizontal: 8 },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statNum: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 10, textAlign: "center" },
  levelCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  levelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelName: { fontSize: 18, fontWeight: "700" },
  levelSubtitle: { fontSize: 13 },
  xpBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  xpText: { fontSize: 14, fontWeight: "700" },
  levelBarBg: { height: 8, borderRadius: 4 },
  levelBarFill: { height: 8, borderRadius: 4 },
  levelNote: { fontSize: 12 },
  streakCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 14 },
  streakTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  streakIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  streakNum: { fontSize: 17, fontWeight: "700" },
  streakSub: { fontSize: 12, marginTop: 1 },
  bestBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  heatmap: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  heatCell: { width: 14, height: 14, borderRadius: 3 },
  chartCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 110 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barMins: { fontSize: 9 },
  barBg: { flex: 1, width: "100%", borderRadius: 4, justifyContent: "flex-end" },
  barFill: { borderRadius: 4, width: "100%" },
  barDay: { fontSize: 10 },
  journeyCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  journeyTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  viewAllBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  viewAllText: { fontSize: 13, fontWeight: "600" },
  journeyBarBg: { height: 8, borderRadius: 4 },
  journeyBarFill: { height: 8, borderRadius: 4 },
  journeyNote: { fontSize: 13, flex: 1 },
  badgesCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 14 },
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeItem: { width: "29%", alignItems: "center", gap: 6 },
  badgeIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  badgeName: { fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 16 },
  badgeDesc: { fontSize: 10, textAlign: "center", lineHeight: 13 },
});
