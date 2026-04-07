import { Icon } from "@/components/Icon";

import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAudio } from "@/context/AudioContext";
import { useContent } from "@/context/ContentContext";
import { SURAHS } from "@/constants/surahs";
import { useColors } from "@/hooks/useColors";

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { nowPlaying } = useAudio();
  const { series: allSeries } = useContent();
  const [query, setQuery] = useState("");
  const isWeb = Platform.OS === "web";
  const hasMiniplayer = !!nowPlaying;

  const seriesResults = useMemo(() =>
    query.length > 1
      ? allSeries.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()) || s.category.toLowerCase().includes(query.toLowerCase()))
      : [],
    [query, allSeries]
  );

  const episodeResults = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    const results: { seriesId: string; seriesTitle: string; episodeId: string; episodeTitle: string; episodeNumber: number; coverColor: string }[] = [];
    for (const s of allSeries) {
      for (const ep of s.episodes) {
        if (ep.title.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q)) {
          results.push({
            seriesId: s.id,
            seriesTitle: s.title,
            episodeId: ep.id,
            episodeTitle: ep.title,
            episodeNumber: ep.number,
            coverColor: s.coverColor,
          });
          if (results.length >= 10) break;
        }
      }
      if (results.length >= 10) break;
    }
    return results;
  }, [query, allSeries]);

  const surahResults = useMemo(() =>
    query.length > 1
      ? SURAHS.filter((s) => s.nameSimple.toLowerCase().includes(query.toLowerCase()) || s.nameArabic.includes(query)).slice(0, 5)
      : [],
    [query]
  );

  const hasResults = seriesResults.length > 0 || episodeResults.length > 0 || surahResults.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 8, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search surahs, series, episodes..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            autoFocus
            autoComplete="off"
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="none"
            importantForAutofill="no"
          />
          {!!query && (
            <Pressable onPress={() => setQuery("")}>
              <Icon name="x" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => "empty"}
        contentContainerStyle={{ padding: 16, paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom, gap: 20 }}
        ListEmptyComponent={
          <>
            {query.length < 2 ? (
              <View style={styles.emptyHint}>
                <Text style={[styles.browseSectionTitle, { color: colors.textMuted }]}>BROWSE CATEGORIES</Text>
                <View style={styles.catGrid}>
                  {[
                    { name: "Seerah", icon: "star" },
                    { name: "Prophets", icon: "users" },
                    { name: "Qur'an", icon: "book-open" },
                    { name: "Sahaba", icon: "heart" },
                    { name: "History", icon: "clock" },
                    { name: "Fiqh", icon: "layers" },
                  ].map((cat) => (
                    <Pressable
                      key={cat.name}
                      onPress={() => setQuery(cat.name)}
                      style={[styles.catChip, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}
                    >
                      <Icon name={cat.icon} size={18} color={colors.goldLight} />
                      <Text style={[styles.catChipText, { color: colors.textPrimary }]}>{cat.name}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.browseSectionTitle, { color: colors.textMuted, marginTop: 24 }]}>TRENDING SEARCHES</Text>
                <View style={{ gap: 8, width: "100%" }}>
                  {["Life of the Prophet", "Al-Kahf", "Companions of the Prophet", "Yusuf (AS)"].map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setQuery(t)}
                      style={[styles.suggestion, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}
                    >
                      <Icon name="trending-up" size={14} color={colors.goldLight} />
                      <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : hasResults ? (
              <View style={{ gap: 16 }}>
                {seriesResults.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <Text style={[styles.resultLabel, { color: colors.textMuted }]}>SERIES ({seriesResults.length})</Text>
                    {seriesResults.map((s) => (
                      <Pressable
                        key={s.id}
                        onPress={() => router.push(`/series/${s.id}`)}
                        style={[styles.resultRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <View style={[styles.resultCover, { backgroundColor: s.coverColor }]}>
                          <Icon name="headphones" size={18} color={colors.goldLight} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.resultTitle, { color: colors.textPrimary }]} numberOfLines={1}>{s.title}</Text>
                          <Text style={[styles.resultMeta, { color: colors.textSecondary }]}>{s.category} · {s.episodeCount} eps</Text>
                        </View>
                        <Icon name="chevron-right" size={18} color={colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                )}
                {episodeResults.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <Text style={[styles.resultLabel, { color: colors.textMuted }]}>EPISODES ({episodeResults.length})</Text>
                    {episodeResults.map((ep) => (
                      <Pressable
                        key={ep.episodeId}
                        onPress={() => router.push(`/series/${ep.seriesId}`)}
                        style={[styles.resultRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <View style={[styles.resultCover, { backgroundColor: ep.coverColor }]}>
                          <Icon name="play" size={16} color={colors.goldLight} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.resultTitle, { color: colors.textPrimary }]} numberOfLines={1}>{ep.episodeTitle}</Text>
                          <Text style={[styles.resultMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                            Ep {ep.episodeNumber} · {ep.seriesTitle}
                          </Text>
                        </View>
                        <Icon name="chevron-right" size={18} color={colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                )}
                {surahResults.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <Text style={[styles.resultLabel, { color: colors.textMuted }]}>QUR'AN ({surahResults.length})</Text>
                    {surahResults.map((s) => (
                      <Pressable
                        key={s.number}
                        onPress={() => router.push(`/quran/${s.number}`)}
                        style={[styles.resultRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <View style={[styles.numBadge, { backgroundColor: colors.gold + "22" }]}>
                          <Text style={[styles.numText, { color: colors.goldLight }]}>{s.number}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>{s.nameSimple}</Text>
                          <Text style={[styles.resultMeta, { color: colors.textSecondary }]}>{s.nameArabic} · {s.verseCount} verses</Text>
                        </View>
                        <Icon name="chevron-right" size={18} color={colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptyHint}>
                <Icon name="search" size={36} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No results for "{query}"</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>Try different keywords or browse by category</Text>
              </View>
            )}
          </>
        }
        renderItem={() => null}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 0.5,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 15 },
  emptyHint: { alignItems: "center", paddingTop: 16, gap: 10, width: "100%" },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptyDesc: { fontSize: 14, textAlign: "center" },
  browseSectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, alignSelf: "flex-start", marginBottom: 4 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, width: "100%" },
  catChip: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  catChipText: { fontSize: 14, fontWeight: "600" },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, width: "100%" },
  suggestionText: { fontSize: 14 },
  resultLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  resultCover: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  resultTitle: { fontSize: 14, fontWeight: "600" },
  resultMeta: { fontSize: 12, marginTop: 2 },
  numBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  numText: { fontSize: 13, fontWeight: "600" },
});
