import { Icon } from "@/components/Icon";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useAuth } from "@/context/AuthContext";
import { useAudio } from "@/context/AudioContext";
import { useUserActions } from "@/context/UserActionsContext";
import { useContent } from "@/context/ContentContext";
import { useColors } from "@/hooks/useColors";
import { CompletedItem, RecentlyPlayedItem, getCompletedContent, getListeningHistory, getRecentlyPlayed } from "@/lib/db";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SeriesCard } from "@/components/SeriesCard";
import { SURAHS } from "@/constants/surahs";

const TABS = ["Continue", "Favourites", "Bookmarks", "History", "Completed"];

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 1) return "< 1 min";
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function relativeDate(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const todayStr = now.toDateString();
  const dStr = d.toDateString();
  if (dStr === todayStr) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dStr === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupByDate(items: RecentlyPlayedItem[]): { label: string; items: RecentlyPlayedItem[] }[] {
  const groups: Record<string, RecentlyPlayedItem[]> = {};
  items.forEach((item) => {
    const label = relativeDate(item.listenedAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export default function LibraryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isGuest, isLoading: authLoading } = useAuth();
  const { nowPlaying, play } = useAudio();
  const { favourites, bookmarks, downloads, downloadProgress, removeDownloadedFile, refreshFromStorage } = useUserActions();
  const { settings } = useAppSettings();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (tabParam === "downloads") {
      setActiveTab(5);
    }
  }, [tabParam]);
  const isWeb = Platform.OS === "web";
  const hasMiniplayer = !!nowPlaying;

  const [continueItems, setContinueItems] = useState<RecentlyPlayedItem[]>([]);
  const [historyItems, setHistoryItems] = useState<RecentlyPlayedItem[]>([]);
  const [completedItems, setCompletedItems] = useState<CompletedItem[]>([]);
  const [continueLoading, setContinueLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [completedLoading, setCompletedLoading] = useState(false);

  const { series: SERIES } = useContent();

  const favouritedSeries = SERIES.filter((s) => favourites.has(`series:${s.id}`));
  const bookmarkedSeries = SERIES.filter((s) => bookmarks.has(`series:${s.id}`));
  const favouritedSurahs = SURAHS.filter((s) => favourites.has(`surah:${s.number}`));
  const bookmarkedSurahs = SURAHS.filter((s) => bookmarks.has(`surah:${s.number}`));
  const downloadedSeries = SERIES.filter((s) =>
    (s.episodes ?? []).some((ep) =>
      downloads.has(`episode:${ep.id}`) || downloads.has(ep.id)
    )
  );
  const downloadedSurahs = SURAHS.filter((s) => downloads.has(`surah:${s.number}`));

  const loadContinue = useCallback(async () => {
    if (!user || isGuest) return;
    setContinueLoading(true);
    try {
      const data = await getRecentlyPlayed(user.id, 10);
      setContinueItems(data);
    } finally {
      setContinueLoading(false);
    }
  }, [user?.id, isGuest]);

  const loadHistory = useCallback(async () => {
    if (!user || isGuest) return;
    setHistoryLoading(true);
    try {
      const data = await getListeningHistory(user.id, 30);
      setHistoryItems(data);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.id, isGuest]);

  const loadCompleted = useCallback(async () => {
    if (!user || isGuest) return;
    setCompletedLoading(true);
    try {
      const data = await getCompletedContent(user.id);
      setCompletedItems(data);
    } finally {
      setCompletedLoading(false);
    }
  }, [user?.id, isGuest]);

  useEffect(() => {
    if (activeTab === 0) loadContinue();
    if (activeTab === 3) loadHistory();
    if (activeTab === 4) loadCompleted();
  }, [activeTab, loadContinue, loadHistory, loadCompleted]);

  // Refresh favourites/bookmarks/downloads from storage every time the user navigates to Library
  useFocusEffect(useCallback(() => {
    refreshFromStorage();
  }, [refreshFromStorage]));

  const historyGroups = groupByDate(historyItems);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0), borderBottomColor: colors.divider }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>My Library</Text>
          <Pressable
            onPress={() => setActiveTab(5)}
            style={[styles.downloadBtn, {
              backgroundColor: activeTab === 5 ? colors.gold + "22" : colors.surfaceHigh,
              borderColor: activeTab === 5 ? colors.gold + "44" : colors.border,
            }]}
          >
            <Icon name="download" size={16} color={activeTab === 5 ? colors.goldLight : colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {TABS.map((tab, i) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(i)}
              style={[styles.tabChip, {
                backgroundColor: i === activeTab ? colors.gold : colors.surfaceHigh,
                borderColor: i === activeTab ? colors.gold : colors.border,
              }]}
            >
              <Text style={[styles.tabText, { color: i === activeTab ? "#fff" : colors.textSecondary }]}>{tab}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Continue ── */}
        {activeTab === 0 && (
          <>
            {isGuest ? (
              <GuestPrompt label="Sign in to see where you left off" onSignIn={() => router.push("/login")} colors={colors} />
            ) : (authLoading || continueLoading) ? (
              <LoadingState colors={colors} />
            ) : continueItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="headphones" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nothing playing yet</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  Start listening to any episode or Qur'an surah and you'll be able to continue right here.
                </Text>
                <Pressable onPress={() => router.push("/(tabs)")} style={[styles.upgradeBtn, { backgroundColor: colors.gold }]}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Browse Content</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Recently played</Text>
                {continueItems.map((item, idx) => (
                  <Pressable
                    key={`${item.contentId}-${idx}`}
                    onPress={() => {
                      if (item.contentType === "surah") router.push(`/quran/${item.contentId}` as any);
                      else if (item.seriesId) router.push(`/series/${item.seriesId}` as any);
                    }}
                    style={[styles.historyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={[styles.histCover, { backgroundColor: colors.surfaceHigh }]}>
                      <Icon name={item.contentType === "surah" ? "book-open" : "headphones"} size={18} color={colors.goldLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.histTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.seriesName && (
                        <Text style={[styles.histMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.seriesName}
                        </Text>
                      )}
                      <Text style={[styles.histMeta, { color: colors.textMuted, marginTop: item.seriesName ? 0 : 2 }]}>
                        {formatDuration(item.durationMs)} · {relativeDate(item.listenedAt)}
                      </Text>
                    </View>
                    <Icon name="play-circle" size={28} color={colors.goldLight} />
                  </Pressable>
                ))}
              </>
            )}
          </>
        )}

        {/* ── Favourites ── */}
        {activeTab === 1 && (
          <>
            {favouritedSeries.length === 0 && favouritedSurahs.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="heart" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No favourites yet</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  Tap the heart icon on any series, episode, or Qur'an surah to save it here.
                </Text>
              </View>
            ) : (
              <>
                {favouritedSeries.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Favourite Series</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                      {favouritedSeries.map((s) => <SeriesCard key={s.id} series={s} />)}
                    </View>
                  </>
                )}
                {favouritedSurahs.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: favouritedSeries.length > 0 ? 8 : 0 }]}>Favourite Surahs</Text>
                    {favouritedSurahs.map((s) => (
                      <Pressable
                        key={s.number}
                        onPress={() => router.push(`/quran/${s.number}` as any)}
                        style={[styles.historyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <View style={[styles.histCover, { backgroundColor: colors.gold + "22" }]}>
                          <Text style={{ color: colors.goldLight, fontWeight: "700", fontSize: 13 }}>{s.number}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.histTitle, { color: colors.textPrimary }]} numberOfLines={1}>{s.nameSimple}</Text>
                          <Text style={[styles.histMeta, { color: colors.textSecondary }]}>{s.nameArabic} · {s.verseCount} verses</Text>
                        </View>
                        <Icon name="heart" size={14} color={colors.gold} />
                      </Pressable>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── Bookmarks ── */}
        {activeTab === 2 && (
          <>
            {bookmarkedSeries.length === 0 && bookmarkedSurahs.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="bookmark" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No bookmarks yet</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  Tap the bookmark icon on any series or surah to save it here.
                </Text>
              </View>
            ) : (
              <>
                {bookmarkedSeries.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Saved Series</Text>
                    {bookmarkedSeries.map((s) => (
                      <Pressable
                        key={s.id}
                        onPress={() => router.push(`/series/${s.id}`)}
                        style={[styles.historyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <View style={[styles.histCover, { backgroundColor: s.coverColor }]}>
                          <Icon name="headphones" size={18} color={colors.goldLight} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.histTitle, { color: colors.textPrimary }]} numberOfLines={1}>{s.title}</Text>
                          <Text style={[styles.histMeta, { color: colors.textSecondary }]}>{s.episodeCount} episodes</Text>
                        </View>
                        <Icon name="bookmark" size={14} color={colors.goldLight} />
                      </Pressable>
                    ))}
                  </>
                )}
                {bookmarkedSurahs.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: bookmarkedSeries.length > 0 ? 8 : 0 }]}>Saved Surahs</Text>
                    {bookmarkedSurahs.map((s) => (
                      <Pressable
                        key={s.number}
                        onPress={() => router.push(`/quran/${s.number}` as any)}
                        style={[styles.historyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <View style={[styles.histCover, { backgroundColor: colors.gold + "22" }]}>
                          <Text style={{ color: colors.goldLight, fontWeight: "700", fontSize: 13 }}>{s.number}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.histTitle, { color: colors.textPrimary }]} numberOfLines={1}>{s.nameSimple}</Text>
                          <Text style={[styles.histMeta, { color: colors.textSecondary }]}>{s.nameArabic} · {s.verseCount} verses</Text>
                        </View>
                        <Icon name="bookmark" size={14} color={colors.goldLight} />
                      </Pressable>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── History ── */}
        {activeTab === 3 && (
          <>
            {isGuest ? (
              <GuestPrompt label="Sign in to view your listening history" onSignIn={() => router.push("/login")} colors={colors} />
            ) : (authLoading || historyLoading) ? (
              <LoadingState colors={colors} />
            ) : historyItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="clock" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No history yet</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  Everything you listen to will be recorded here.
                </Text>
              </View>
            ) : (
              historyGroups.map(({ label, items }) => (
                <View key={label} style={{ gap: 8 }}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{label}</Text>
                  {items.map((item, idx) => (
                    <Pressable
                      key={`${item.contentId}-${idx}`}
                      onPress={() => {
                        if (item.contentType === "surah") router.push(`/quran/${item.contentId}` as any);
                        else if (item.seriesId) router.push(`/series/${item.seriesId}` as any);
                      }}
                      style={[styles.historyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <View style={[styles.histCover, { backgroundColor: colors.surfaceHigh }]}>
                        <Icon name={item.contentType === "surah" ? "book-open" : "headphones"} size={18} color={colors.goldLight} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.histTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {item.seriesName && (
                          <Text style={[styles.histMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.seriesName}
                          </Text>
                        )}
                        <Text style={[styles.histMeta, { color: colors.textMuted }]}>
                          {formatDuration(item.durationMs)}
                        </Text>
                      </View>
                      <Icon name="play-circle" size={24} color={colors.goldLight} />
                    </Pressable>
                  ))}
                </View>
              ))
            )}
          </>
        )}

        {/* ── Completed ── */}
        {activeTab === 4 && (
          <>
            {isGuest ? (
              <GuestPrompt label="Sign in to see your completed content" onSignIn={() => router.push("/login")} colors={colors} />
            ) : (authLoading || completedLoading) ? (
              <LoadingState colors={colors} />
            ) : completedItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="check-circle" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No completed content yet</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  Content you finish (90%+ listened) will appear here automatically.
                </Text>
                <Pressable onPress={() => router.push("/(tabs)")} style={[styles.upgradeBtn, { backgroundColor: colors.gold }]}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Browse Content</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  {completedItems.length} item{completedItems.length !== 1 ? "s" : ""} completed
                </Text>
                {completedItems.map((item, idx) => (
                  <Pressable
                    key={`${item.contentId}-${idx}`}
                    onPress={() => {
                      if (item.contentType === "surah") router.push(`/quran/${item.contentId}` as any);
                      else if (item.seriesId) router.push(`/series/${item.seriesId}` as any);
                    }}
                    style={[styles.historyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={[styles.histCover, { backgroundColor: colors.surfaceHigh }]}>
                      <Icon name={item.contentType === "surah" ? "book-open" : "headphones"} size={18} color={colors.goldLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.histTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.seriesName && (
                        <Text style={[styles.histMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.seriesName}
                        </Text>
                      )}
                      <Text style={[styles.histMeta, { color: colors.textMuted }]}>
                        {formatDuration(item.durationMs)} · completed
                      </Text>
                    </View>
                    <View style={[styles.numBadge, { backgroundColor: colors.green + "22" }]}>
                      <Icon name="check-circle" size={18} color={colors.green} />
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </>
        )}

        {/* ── Downloads ── */}
        {activeTab === 5 && (
          <>
            {settings.subscription_enabled && !user?.isPremium ? (
              <View style={styles.emptyState}>
                <Icon name="lock" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Premium Feature</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  Offline downloads are available for premium subscribers.
                </Text>
                <Pressable
                  onPress={() => router.push("/subscription")}
                  style={{ marginTop: 16, backgroundColor: colors.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Upgrade Now</Text>
                </Pressable>
              </View>
            ) : downloadedSeries.length > 0 || downloadedSurahs.length > 0 || downloadProgress.size > 0 ? (
              <>
                {downloadProgress.size > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Downloading</Text>
                    {Array.from(downloadProgress.entries()).map(([epKey, pct]) => {
                      const rawId = epKey.startsWith("episode:") ? epKey.slice(8) : epKey;
                      const series = SERIES.find((s) => s.episodes?.some((ep) => ep.id === rawId));
                      const episode = series?.episodes?.find((ep) => ep.id === rawId);
                      const epId = epKey;
                      return (
                        <View key={epId} style={[styles.historyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <View style={[styles.histCover, { backgroundColor: colors.surfaceHigh }]}>
                            <ActivityIndicator size="small" color={colors.goldLight} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.histTitle, { color: colors.textPrimary }]} numberOfLines={1}>{episode?.title ?? epId}</Text>
                            <View style={{ height: 4, backgroundColor: colors.divider, borderRadius: 2, marginTop: 6 }}>
                              <View style={{ height: 4, backgroundColor: colors.gold, borderRadius: 2, width: `${Math.round(pct * 100)}%` }} />
                            </View>
                            <Text style={[styles.histMeta, { color: colors.textMuted, marginTop: 4 }]}>{Math.round(pct * 100)}%</Text>
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
                {downloadedSeries.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Downloaded</Text>
                    {downloadedSeries.map((s) => {
                      const dlEpisodes = (s.episodes ?? []).filter((ep) =>
                        downloads.has(`episode:${ep.id}`) || downloads.has(ep.id)
                      );
                      return (
                        <View key={s.id}>
                          <Pressable
                            onPress={() => router.push(`/series/${s.id}`)}
                            style={[styles.historyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                          >
                            <View style={[styles.histCover, { backgroundColor: s.coverColor }]}>
                              <Icon name="headphones" size={18} color={colors.goldLight} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.histTitle, { color: colors.textPrimary }]} numberOfLines={1}>{s.title}</Text>
                              <Text style={[styles.histMeta, { color: colors.textSecondary }]}>{dlEpisodes.length} downloaded</Text>
                            </View>
                            <View style={[styles.numBadge, { backgroundColor: colors.green + "22" }]}>
                              <Icon name="check-circle" size={14} color={colors.green} />
                            </View>
                          </Pressable>
                          {dlEpisodes.map((ep) => {
                            const epIndex = (s.episodes ?? []).findIndex((e) => e.id === ep.id);
                            return (
                              <Pressable
                                key={ep.id}
                                onPress={async () => {
                                  await play({
                                    id: ep.id,
                                    title: ep.title,
                                    seriesName: s.title,
                                    seriesId: s.id,
                                    coverColor: s.coverColor,
                                    coverUrl: s.coverUrl,
                                    audioUrl: ep.audioUrl,
                                    type: "story",
                                    episodeIndex: epIndex >= 0 ? epIndex : 0,
                                  }, user?.id);
                                  router.push("/player");
                                }}
                                style={[styles.historyRow, { backgroundColor: colors.surface, borderColor: colors.border, marginLeft: 20, marginTop: 4 }]}
                              >
                                <View style={[styles.histCover, { backgroundColor: s.coverColor + "33", width: 28, height: 28, borderRadius: 6 }]}>
                                  <Icon name="play" size={12} color={s.coverColor || colors.gold} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.histTitle, { color: colors.textPrimary }]} numberOfLines={1}>{ep.title}</Text>
                                </View>
                                <Pressable
                                  onPress={(e) => {
                                    e.stopPropagation?.();
                                    const dlKey = downloads.has(`episode:${ep.id}`) ? `episode:${ep.id}` : ep.id;
                                    if (Platform.OS === "web") {
                                      removeDownloadedFile(dlKey);
                                    } else {
                                      Alert.alert("Remove Download", `Remove "${ep.title}" from downloads?`, [
                                        { text: "Cancel", style: "cancel" },
                                        { text: "Remove", style: "destructive", onPress: () => removeDownloadedFile(dlKey) },
                                      ]);
                                    }
                                  }}
                                  style={{ padding: 8 }}
                                >
                                  <Icon name="trash-2" size={16} color={colors.error ?? "#EF4444"} />
                                </Pressable>
                              </Pressable>
                            );
                          })}
                        </View>
                      );
                    })}
                  </>
                )}
                {downloadedSurahs.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Downloaded Surahs</Text>
                    {downloadedSurahs.map((s) => (
                      <Pressable
                        key={s.number}
                        onPress={() => router.push(`/quran/${s.number}`)}
                        style={[styles.historyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <View style={[styles.histCover, { backgroundColor: colors.green + "33" }]}>
                          <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13 }}>{s.number}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.histTitle, { color: colors.textPrimary }]} numberOfLines={1}>{s.nameSimple}</Text>
                          <Text style={[styles.histMeta, { color: colors.textSecondary }]}>{s.nameArabic} · {s.verseCount} Ayahs</Text>
                        </View>
                        <Pressable
                          onPress={() => removeDownloadedFile(`surah:${s.number}`)}
                          style={{ padding: 8 }}
                        >
                          <Icon name="trash-2" size={16} color={colors.error ?? "#EF4444"} />
                        </Pressable>
                      </Pressable>
                    ))}
                  </>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Icon name="download" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No downloads yet</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  Tap the download icon on any episode to save it for offline listening.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function LoadingState({ colors }: { colors: any }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
      <ActivityIndicator color={colors.gold} size="large" />
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>Loading…</Text>
    </View>
  );
}

function GuestPrompt({ label, onSignIn, colors }: { label: string; onSignIn: () => void; colors: any }) {
  return (
    <View style={[styles.emptyState]}>
      <Icon name="user" size={40} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sign in required</Text>
      <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>{label}</Text>
      <Pressable onPress={onSignIn} style={[styles.upgradeBtn, { backgroundColor: colors.gold }]}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>Sign In</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    paddingTop: 8,
  },
  downloadBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  histCover: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  histTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  histMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  numBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  upgradeBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
});
