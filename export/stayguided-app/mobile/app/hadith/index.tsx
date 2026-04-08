import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { HADITH_BOOKS, HadithBook } from "@/constants/hadith";
import { useState, useCallback, useMemo } from "react";

const BOOKMARKS_KEY = "hadith_bookmarks_v2";

export default function HadithBooksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isWeb = Platform.OS === "web";
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return HADITH_BOOKS;
    const q = search.toLowerCase();
    return HADITH_BOOKS.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
    );
  }, [search]);

  const renderBook = useCallback(
    ({ item, index }: { item: HadithBook; index: number }) => {
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push(`/hadith/${item.id}` as any)}
          style={[
            styles.bookCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginBottom: index === filtered.length - 1 ? 0 : 12,
            },
          ]}
        >
          <View
            style={[
              styles.bookIconPanel,
              { backgroundColor: item.color + "DD" },
            ]}
          >
            <Icon name="scroll" size={20} color="#fff" />
          </View>
          <View style={styles.bookBody}>
            <View style={styles.bookHeader}>
              <View style={styles.bookTitleRow}>
                <Text
                  style={[styles.bookName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={[styles.bookArabic, { color: colors.goldLight }]}
                >
                  {item.arabicName}
                </Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: item.color + "22" },
                ]}
              >
                <Text style={[styles.countText, { color: item.color === "#1a4a2e" ? "#4ade80" : "#a78bfa" }]}>
                  {item.total.toLocaleString()}
                </Text>
              </View>
            </View>

            <Text
              style={[styles.bookAuthor, { color: colors.goldLight }]}
            >
              {item.author}
            </Text>
            <Text
              style={[styles.bookDesc, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.description}
            </Text>

            <View style={styles.bookFooter}>
              <Text style={[styles.hadithCount, { color: colors.textMuted }]}>
                {item.total.toLocaleString()} hadiths
              </Text>
              <View style={[styles.readBtn, { backgroundColor: item.color + "22" }]}>
                <Text style={[styles.readBtnText, { color: colors.goldLight }]}>
                  Read
                </Text>
                <Icon name="chevron-right" size={14} color={colors.goldLight} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, filtered.length, router]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colors.background === "#0a0a0a" ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (isWeb ? 67 : 0) + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="chevron-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Hadith
          </Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>
            {HADITH_BOOKS.length} books available
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/hadith/bookmarks" as any)}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="bookmark" size={20} color={colors.goldLight} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { paddingHorizontal: 16, paddingVertical: 12 }]}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search books..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Icon name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Banner */}
      <View
        style={[
          styles.banner,
          { backgroundColor: colors.surfaceHigh, marginHorizontal: 16, marginBottom: 16 },
        ]}
      >
        <View style={[styles.bannerIcon, { backgroundColor: colors.goldLight + "22" }]}>
          <Icon name="book-open" size={22} color={colors.goldLight} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.textPrimary }]}>
            The Sunnah of the Prophet ﷺ
          </Text>
          <Text style={[styles.bannerSub, { color: colors.textSecondary }]}>
            Browse all major hadith collections with English translations
          </Text>
        </View>
      </View>

      {/* Books List */}
      <FlatList
        data={filtered}
        renderItem={renderBook}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="search" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No books found for "{search}"
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },
  searchWrap: {},
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 14,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  bannerSub: { fontSize: 12, lineHeight: 16 },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  bookCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  bookIconPanel: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  bookBody: { flex: 1, padding: 14 },
  bookHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  bookTitleRow: { flex: 1, marginRight: 8 },
  bookName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  bookArabic: { fontSize: 13, fontFamily: "System" },
  countBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 11, fontWeight: "700" },
  bookAuthor: { fontSize: 12, fontWeight: "500", marginBottom: 6 },
  bookDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  bookFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hadithCount: { fontSize: 12 },
  readBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  readBtnText: { fontSize: 12, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
