import { Icon } from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

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

export default function JourneyScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { nowPlaying } = useAudio();
  const isWeb = Platform.OS === "web";
  const hasMiniplayer = !!nowPlaying;

  const [chapters, setChapters] = useState<JourneyChapter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChapters = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("journey_chapters")
        .select("*")
        .eq("is_published", true)
        .order("order_index");
      if (error) {
        console.warn("Journey fetch error:", error.message);
      }
      setChapters(data ?? []);
    } catch (err) {
      console.warn("Journey fetch error:", err);
      setChapters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChapters(); }, [fetchChapters]);

  const totalChapters = chapters.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Back button — always fixed, never scrolls away */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtnFixed, { top: insets.top + (isWeb ? 67 : 0) + 10, left: 16 }]}
      >
        <View style={styles.backBtnInner}>
          <Icon name="arrow-left" size={20} color="#fff" />
        </View>
      </Pressable>

      <ScrollView
        contentContainerStyle={{ paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.gold + "33", colors.background]}
          style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 60 }]}
        >
          <Text style={[styles.label, { color: colors.goldLight }]}>THE COMPLETE STORY</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Journey Through Islam</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {totalChapters} chapters · From Creation to the Khulafa Rashidun
          </Text>

          <Pressable
            onPress={() => {
              const first = chapters[0];
              if (first?.series_id) router.push(`/series/${first.series_id}`);
            }}
            style={[styles.ctaBtn, { backgroundColor: colors.gold }]}
          >
            <Icon name="play" size={16} color="#fff" />
            <Text style={styles.ctaBtnText}>Start from the Beginning</Text>
          </Pressable>
        </LinearGradient>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.gold} size="large" />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading journey...</Text>
          </View>
        ) : chapters.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="book-open" size={32} color={colors.textMuted} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>No chapters published yet</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {chapters.map((chapter, idx) => {
              const isLast = idx === chapters.length - 1;
              return (
                <View key={chapter.id} style={styles.chapterRow}>
                  <View style={styles.timelineCol}>
                    <View style={[
                      styles.timelineDot,
                      { backgroundColor: colors.surface, borderColor: colors.border }
                    ]}>
                      <Text style={[styles.dotNum, { color: colors.textMuted }]}>{chapter.chapter_number}</Text>
                    </View>
                    {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                  </View>

                  <Pressable
                    onPress={() => {
                      if (chapter.series_id) router.push(`/series/${chapter.series_id}`);
                    }}
                    style={[styles.chapterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={styles.chapterTop}>
                      <View style={styles.chapterTitles}>
                        {chapter.era_label && (
                          <Text style={[styles.chapterEra, { color: colors.goldLight }]}>
                            {chapter.era_label}
                          </Text>
                        )}
                        <Text style={[styles.chapterTitle, { color: colors.textPrimary }]}>{chapter.title}</Text>
                      </View>
                      {(chapter.episode_count ?? 0) > 0 && (
                        <Text style={[styles.chapterEps, { color: colors.textSecondary }]}>
                          {chapter.episode_count} eps
                        </Text>
                      )}
                    </View>
                    {chapter.description && (
                      <Text style={[styles.chapterDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {chapter.description}
                      </Text>
                    )}
                    {chapter.show_coming_soon && !chapter.is_published && (
                      <Text style={[styles.comingSoon, { color: colors.gold }]}>Coming Soon</Text>
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
    paddingBottom: 28,
    gap: 6,
  },
  backBtnFixed: {
    position: "absolute",
    zIndex: 20,
  },
  backBtnInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(8,15,28,0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.6,
    borderColor: "rgba(255,255,255,0.18)",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    marginTop: 12,
  },
  ctaBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  timeline: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chapterRow: {
    flexDirection: "row",
    gap: 14,
    minHeight: 80,
  },
  timelineCol: {
    alignItems: "center",
    width: 32,
    paddingTop: 4,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  dotNum: {
    fontSize: 11,
    fontWeight: "600",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -4,
  },
  chapterCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 4,
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
    fontSize: 15,
    fontWeight: "700",
  },
  chapterEps: {
    fontSize: 11,
    marginTop: 2,
  },
  chapterDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  comingSoon: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});
