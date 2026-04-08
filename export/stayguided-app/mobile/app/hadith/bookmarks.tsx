import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { HADITH_BOOKS } from "@/constants/hadith";
import { useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BOOKMARKS_KEY = "hadith_bookmarks_v2";

interface BookmarkedHadith {
  hadithnumber: number;
  text: string;
  grades?: { grade: string; graded_by: string }[];
  bookId: string;
  bookName: string;
}

export default function HadithBookmarksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [bookmarks, setBookmarks] = useState<BookmarkedHadith[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, []);

  async function loadBookmarks() {
    try {
      const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
      setBookmarks(raw ? JSON.parse(raw) : []);
    } finally {
      setLoading(false);
    }
  }

  async function removeBookmark(bookId: string, hadithNumber: number) {
    const updated = bookmarks.filter(
      (b) => !(b.bookId === bookId && b.hadithnumber === hadithNumber)
    );
    setBookmarks(updated);
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
  }

  async function shareHadith(item: BookmarkedHadith) {
    await Share.share({
      message: `Hadith #${item.hadithnumber} — ${item.bookName}\n\n${item.text}\n\n— StayGuided Me`,
    });
  }

  function confirmRemove(item: BookmarkedHadith) {
    Alert.alert(
      "Remove Bookmark",
      "Remove this hadith from your bookmarks?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeBookmark(item.bookId, item.hadithnumber),
        },
      ]
    );
  }

  const bookColor = (bookId: string) =>
    HADITH_BOOKS.find((b) => b.id === bookId)?.color ?? "#1a4a2e";

  const renderItem = useCallback(
    ({ item }: { item: BookmarkedHadith }) => {
      const color = bookColor(item.bookId);
      const isLong = item.text.length > 280;
      const displayText = isLong ? item.text.slice(0, 280) + "…" : item.text;

      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push(`/hadith/${item.bookId}` as any)}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.cardAccent, { backgroundColor: color + "CC" }]} />
          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <View style={[styles.numBadge, { backgroundColor: color + "22" }]}>
                <Text style={[styles.numText, { color: colors.goldLight }]}>
                  #{item.hadithnumber}
                </Text>
              </View>
              <Text style={[styles.bookName, { color: colors.goldLight }]}>
                {item.bookName}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => shareHadith(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="share-2" size={16} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmRemove(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="trash-2" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.text, { color: colors.textPrimary }]}>
              {displayText}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, router]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="chevron-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Bookmarks
          </Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>
            {bookmarks.length} saved hadiths
          </Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {bookmarks.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Icon name="bookmark" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            No bookmarks yet
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Tap the bookmark icon on any hadith to save it here
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.browseBtn, { backgroundColor: colors.goldLight + "22" }]}
          >
            <Text style={[styles.browseBtnText, { color: colors.goldLight }]}>
              Browse Hadiths
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookmarks}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.bookId}-${item.hadithnumber}`}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },
  list: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  numBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  numText: { fontSize: 11, fontWeight: "700" },
  bookName: { fontSize: 12, fontWeight: "600", flex: 1 },
  actions: { flexDirection: "row", gap: 12 },
  text: { fontSize: 13, lineHeight: 20 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginTop: 12 },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  browseBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  browseBtnText: { fontSize: 14, fontWeight: "600" },
});
