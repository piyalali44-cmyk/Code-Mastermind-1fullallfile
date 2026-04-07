import { Icon } from "@/components/Icon";

import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAudio } from "@/context/AudioContext";
import { SURAHS } from "@/constants/surahs";
import { useColors } from "@/hooks/useColors";

export default function QuranScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { nowPlaying } = useAudio();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() =>
    query.trim()
      ? SURAHS.filter(
          (s) =>
            s.nameSimple.toLowerCase().includes(query.toLowerCase()) ||
            s.nameArabic.includes(query) ||
            s.number.toString().includes(query)
        )
      : SURAHS,
    [query]
  );

  const isWeb = Platform.OS === "web";
  const hasMiniplayer = !!nowPlaying;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0), backgroundColor: colors.background, borderBottomColor: colors.divider }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Holy Qur'an</Text>
          <View style={[styles.freeBadge, { backgroundColor: colors.green + "22", borderColor: colors.green + "44" }]}>
            <Text style={[styles.freeBadgeText, { color: colors.green }]}>FREE FOREVER</Text>
          </View>
        </View>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search surahs..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
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
        data={filtered}
        keyExtractor={(item) => item.number.toString()}
        contentContainerStyle={{ paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              
              router.push(`/quran/${item.number}`);
            }}
            style={[styles.surahRow, { borderBottomColor: colors.divider }]}
          >
            <View style={[styles.numBadge, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "44" }]}>
              <Text style={[styles.numText, { color: colors.goldLight }]}>{item.number}</Text>
            </View>
            <View style={styles.surahInfo}>
              <View style={styles.surahTop}>
                <Text style={[styles.surahName, { color: colors.textPrimary }]}>{item.nameSimple}</Text>
                <Text style={[styles.surahArabic, { color: colors.textGold }]}>{item.nameArabic}</Text>
              </View>
              <View style={styles.surahBottom}>
                <Text style={[styles.surahMeta, { color: colors.textSecondary }]}>{item.verseCount} verses</Text>
                <View style={[styles.revBadge, {
                  backgroundColor: item.revelationType === "Meccan" ? colors.gold + "22" : colors.green + "22",
                }]}>
                  <Text style={[styles.revText, {
                    color: item.revelationType === "Meccan" ? colors.goldLight : colors.green,
                  }]}>{item.revelationType}</Text>
                </View>
              </View>
            </View>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="book-open" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No surahs found</Text>
          </View>
        }
      />
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
    paddingTop: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  freeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  surahRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    borderBottomWidth: 0.5,
  },
  numBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  numText: {
    fontSize: 14,
    fontWeight: "600",
  },
  surahInfo: {
    flex: 1,
    gap: 4,
  },
  surahTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  surahName: {
    fontSize: 16,
    fontWeight: "600",
  },
  surahArabic: {
    fontSize: 18,
    fontFamily: "Inter_400Regular",
  },
  surahBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  surahMeta: {
    fontSize: 12,
  },
  revBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  revText: {
    fontSize: 10,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
});
