import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Share,
  TextInput,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { addXp } from "@/lib/db";
import { HADITH_BOOKS, BASE_HADITH_API } from "@/constants/hadith";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import * as Clipboard from "expo-clipboard";

const PAGE_SIZE = 30;
const BOOKMARKS_KEY = "hadith_bookmarks_v2";
const XP_READ_KEY = "hadith_xp_awarded_v1";
const LANG_KEY = "hadith_lang_pref";
const SHOW_ARABIC_KEY = "hadith_show_arabic";
const SHOW_EN_KEY = "hadith_show_en";
const PLAYER_BAR_HEIGHT = 72;

interface HadithItem {
  hadithnumber: number;
  narrator: string;
  body: string;
  arabic: string;
  grades?: { grade: string; graded_by: string }[];
  reference?: string;
}

interface BookmarkedHadith extends HadithItem {
  bookId: string;
  bookName: string;
}

const TRANSLATE_LANGS: { code: string; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu" },
  { code: "fa", name: "Persian", nativeName: "فارسی" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili" },
  { code: "ha", name: "Hausa", nativeName: "Hausa" },
  { code: "so", name: "Somali", nativeName: "Soomaali" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "ro", name: "Romanian", nativeName: "Română" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
];

const translateCache = new Map<string, string>();
const TRANSLATE_CACHE_PREFIX = "hadith_translate_";

async function loadTranslateCacheFromStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const translateKeys = keys.filter((k) => k.startsWith(TRANSLATE_CACHE_PREFIX));
    if (translateKeys.length === 0) return;
    const pairs = await AsyncStorage.multiGet(translateKeys);
    for (const [key, value] of pairs) {
      if (value) {
        const cacheKey = key.substring(TRANSLATE_CACHE_PREFIX.length);
        translateCache.set(cacheKey, value);
      }
    }
  } catch {}
}

async function saveTranslateToStorage(cacheKey: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TRANSLATE_CACHE_PREFIX + cacheKey, value);
  } catch {}
}

let _translateCacheLoaded = false;
async function ensureTranslateCacheLoaded(): Promise<void> {
  if (_translateCacheLoaded) return;
  _translateCacheLoaded = true;
  await loadTranslateCacheFromStorage();
}

function splitIntoChunks(text: string, maxLen = 4500): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cutAt = -1;
    for (let i = maxLen; i > 100; i--) {
      const ch = remaining[i];
      if (ch === "." || ch === "،" || ch === "؟" || ch === "!" || ch === "\n") {
        cutAt = i;
        break;
      }
    }
    if (cutAt < 100) cutAt = remaining.lastIndexOf(" ", maxLen);
    if (cutAt < 1) cutAt = maxLen;
    chunks.push(remaining.substring(0, cutAt + 1).trim());
    remaining = remaining.substring(cutAt + 1).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

async function googleTranslateChunk(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const encoded = encodeURIComponent(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encoded}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translation error ${res.status}`);
  const json = await res.json();
  // Response format: [[[translated, original, ...], ...], ...]
  if (Array.isArray(json) && Array.isArray(json[0])) {
    return (json[0] as any[])
      .map((item: any) => (Array.isArray(item) ? item[0] ?? "" : ""))
      .join("");
  }
  return text;
}

async function translateText(
  arabicText: string,
  englishText: string,
  targetLang: string
): Promise<string> {
  if (targetLang === "en") return englishText;
  // Prefer Arabic → target for authenticity; fall back to English → target
  await ensureTranslateCacheLoaded();
  const hasArabic = arabicText && arabicText.trim().length > 10;
  const sourceText = hasArabic ? arabicText : englishText;
  const sourceLang = hasArabic ? "ar" : "en";
  const cacheKey = `${sourceLang}|${targetLang}::${sourceText.substring(0, 60)}`;
  if (translateCache.has(cacheKey)) return translateCache.get(cacheKey)!;
  try {
    // Google Translate supports up to ~5000 chars per request — split only if needed
    const chunks = splitIntoChunks(sourceText, 4500);
    const results = await Promise.all(
      chunks.map((c) => googleTranslateChunk(c, sourceLang, targetLang))
    );
    const translated = results.join(" ").trim();
    if (translated.length < 2) throw new Error("Empty result");
    translateCache.set(cacheKey, translated);
    saveTranslateToStorage(cacheKey, translated);
    return translated;
  } catch {
    // Fallback: try English → target if Arabic failed
    if (sourceLang === "ar") {
      try {
        const chunks = splitIntoChunks(englishText, 4500);
        const results = await Promise.all(
          chunks.map((c) => googleTranslateChunk(c, "en", targetLang))
        );
        const translated = results.join(" ").trim();
        if (translated.length > 2) {
          translateCache.set(cacheKey, translated);
          saveTranslateToStorage(cacheKey, translated);
          return translated;
        }
      } catch {}
    }
    return englishText;
  }
}

async function fetchAllHadiths(bookId: string): Promise<HadithItem[]> {
  const url = `${BASE_HADITH_API}/${bookId}/all`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.hadiths)) throw new Error("Unexpected response");
  return json.hadiths as HadithItem[];
}

async function getXpPerHadith(): Promise<number> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "xp_per_hadith")
      .single();
    return parseInt(data?.value ?? "5") || 5;
  } catch {
    return 5;
  }
}

export default function HadithBookScreen() {
  const router = useRouter();
  const { book: bookId } = useLocalSearchParams<{ book: string }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user } = useAuth();
  const isWeb = Platform.OS === "web";

  const bookMeta = HADITH_BOOKS.find((b) => b.id === bookId);
  const bookColor = bookMeta?.color ?? "#1a4a2e";
  const accentColor = bookColor === "#1a4a2e" ? "#4ade80" : colors.goldLight;

  const [allHadiths, setAllHadiths] = useState<HadithItem[]>([]);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const searchRef = useRef<TextInput>(null);

  const [showArabic, setShowArabic] = useState(true);
  const [showEnglish, setShowEnglish] = useState(true);
  const [selectedLang, setSelectedLang] = useState({ code: "en", name: "English", nativeName: "English" });
  const [langModal, setLangModal] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translations, setTranslations] = useState<Map<number, string>>(new Map());
  const [xpPerHadith, setXpPerHadith] = useState(5);
  const [awardedXpIds, setAwardedXpIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SHOW_ARABIC_KEY).then((v) => {
      if (v !== null) setShowArabic(v === "true");
    });
    AsyncStorage.getItem(SHOW_EN_KEY).then((v) => {
      if (v !== null) setShowEnglish(v === "true");
    });
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (v) {
        const found = TRANSLATE_LANGS.find((l) => l.code === v);
        if (found) setSelectedLang(found);
      }
    });
    loadBookmarks();
    loadHadiths();
    getXpPerHadith().then(setXpPerHadith);
    loadAwardedXp();
  }, [bookId]);

  async function loadAwardedXp() {
    const raw = await AsyncStorage.getItem(`${XP_READ_KEY}_${bookId}`);
    if (raw) setAwardedXpIds(new Set(JSON.parse(raw)));
  }

  async function loadBookmarks() {
    try {
      const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
      const all: BookmarkedHadith[] = raw ? JSON.parse(raw) : [];
      const ids = new Set(
        all.filter((b) => b.bookId === bookId).map((b) => b.hadithnumber)
      );
      setBookmarks(ids);
    } catch {}
  }

  async function loadHadiths() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllHadiths(bookId!);
      setAllHadiths(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load hadiths.");
    } finally {
      setLoading(false);
    }
  }

  const filteredHadiths = useMemo(
    () =>
      searchQuery.trim().length > 1
        ? allHadiths.filter(
            (h) =>
              h.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
              h.narrator.toLowerCase().includes(searchQuery.toLowerCase()) ||
              h.arabic.includes(searchQuery)
          )
        : allHadiths,
    [allHadiths, searchQuery]
  );

  const displayData = filteredHadiths.slice(0, displayCount);
  const hasMore = displayCount < filteredHadiths.length;

  function loadMore() {
    setDisplayCount((c) => c + PAGE_SIZE);
  }

  async function toggleBookmark(hadith: HadithItem) {
    try {
      const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
      let all: BookmarkedHadith[] = raw ? JSON.parse(raw) : [];
      const exists = all.some(
        (b) => b.bookId === bookId && b.hadithnumber === hadith.hadithnumber
      );
      if (exists) {
        all = all.filter(
          (b) => !(b.bookId === bookId && b.hadithnumber === hadith.hadithnumber)
        );
        setBookmarks((prev) => {
          const next = new Set(prev);
          next.delete(hadith.hadithnumber);
          return next;
        });
      } else {
        all.push({ ...hadith, bookId: bookId!, bookName: bookMeta?.name ?? bookId! });
        setBookmarks((prev) => new Set(prev).add(hadith.hadithnumber));
      }
      await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
    } catch {}
  }

  async function shareHadith(hadith: HadithItem) {
    const narratorPart = hadith.narrator ? `[${hadith.narrator}]\n\n` : "";
    await Share.share({
      message: `Hadith #${hadith.hadithnumber} — ${bookMeta?.name}\n\n${narratorPart}${hadith.body}\n\n— StayGuided Me`,
    });
  }

  async function copyHadith(hadith: HadithItem) {
    const translatedBody = translations.get(hadith.hadithnumber);
    const narratorPart = hadith.narrator ? `Narrated by ${hadith.narrator}:\n\n` : "";
    const arabicPart = hadith.arabic?.trim() ? `${hadith.arabic.trim()}\n\n` : "";
    const englishPart = hadith.body?.trim() ?? "";
    const translationPart =
      translatedBody && selectedLang.code !== "en"
        ? `\n\n— ${selectedLang.name} Translation —\n${translatedBody.trim()}`
        : "";
    const refLine = hadith.reference ? `\nRef: ${hadith.reference}` : "";
    const text =
      `${bookMeta?.name} — Hadith #${hadith.hadithnumber}\n` +
      `${"─".repeat(40)}\n\n` +
      `${arabicPart}` +
      `${narratorPart}` +
      `${englishPart}` +
      `${translationPart}\n` +
      `${"─".repeat(40)}` +
      `${refLine}\n` +
      `— StayGuided Me`;
    await Clipboard.setStringAsync(text);
    setCopiedId(hadith.hadithnumber);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleHadithRead(hadith: HadithItem) {
    if (!user?.id || awardedXpIds.has(hadith.hadithnumber)) return;
    try {
      await addXp(user.id, xpPerHadith, `hadith_read:${bookId}:${hadith.hadithnumber}`);
      const next = new Set(awardedXpIds).add(hadith.hadithnumber);
      setAwardedXpIds(next);
      await AsyncStorage.setItem(
        `${XP_READ_KEY}_${bookId}`,
        JSON.stringify([...next])
      );
    } catch {}
  }

  const translatingRef = useRef(false);

  async function applyTranslation(targetLang: string, hadiths: HadithItem[], existingMap: Map<number, string>) {
    if (targetLang === "en") {
      setTranslations(new Map());
      return;
    }
    if (translatingRef.current) return;
    translatingRef.current = true;
    setTranslating(true);
    const newMap = new Map(existingMap);
    const toTranslate = hadiths.filter((h) => !newMap.has(h.hadithnumber));
    const batchSize = 4;
    for (let i = 0; i < toTranslate.length; i += batchSize) {
      if (!translatingRef.current) break;
      const batch = toTranslate.slice(i, i + batchSize);
      try {
        const results = await Promise.all(
          batch.map((h) => translateText(h.arabic, h.body, targetLang))
        );
        batch.forEach((h, idx) => {
          if (results[idx] && results[idx].length > 2) {
            newMap.set(h.hadithnumber, results[idx]);
          }
        });
        setTranslations(new Map(newMap));
      } catch {}
    }
    translatingRef.current = false;
    setTranslating(false);
  }

  function handleLangSelect(lang: typeof TRANSLATE_LANGS[0]) {
    translatingRef.current = false;
    setSelectedLang(lang);
    setTranslations(new Map());
    AsyncStorage.setItem(LANG_KEY, lang.code);
    setLangModal(false);
  }

  useEffect(() => {
    if (displayData.length > 0 && selectedLang.code !== "en") {
      applyTranslation(selectedLang.code, displayData, translations);
    }
  }, [selectedLang.code, displayCount, allHadiths.length]);

  const renderHadith = useCallback(
    ({ item }: { item: HadithItem }) => {
      const isBookmarked = bookmarks.has(item.hadithnumber);
      const isExpanded = expandedId === item.hadithnumber;
      const grade = item.grades?.[0];
      const translatedBody = translations.get(item.hadithnumber);
      const displayBody = translatedBody || item.body;
      const isCopied = copiedId === item.hadithnumber;
      const isLong = displayBody.length > 500;
      const truncated = isLong && !isExpanded ? displayBody.slice(0, 500) + "…" : displayBody;

      const gradeColor =
        grade?.grade === "Sahih" || grade?.grade === "Authentic"
          ? "#4ade80"
          : grade?.grade === "Hasan" || grade?.grade === "Good"
          ? "#fbbf24"
          : grade?.grade === "Da'if" || grade?.grade === "Weak"
          ? "#f87171"
          : colors.textMuted;
      const gradeBg =
        grade?.grade === "Sahih" || grade?.grade === "Authentic"
          ? "#15803d20"
          : grade?.grade === "Hasan" || grade?.grade === "Good"
          ? "#92400e20"
          : grade?.grade === "Da'if" || grade?.grade === "Weak"
          ? "#7f1d1d20"
          : "#6b728020";

      return (
        <View
          style={[
            styles.hadithCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Card top row */}
          <View style={styles.cardTop}>
            <View style={[styles.numBadge, { backgroundColor: bookColor + "20", borderColor: bookColor + "40" }]}>
              <Text style={[styles.numText, { color: bookColor === "#1a4a2e" ? "#4ade80" : colors.goldLight }]}>
                {item.hadithnumber}
              </Text>
            </View>

            {grade && (
              <View style={[styles.gradeBadge, { backgroundColor: gradeBg, borderColor: gradeColor + "40" }]}>
                <View style={[styles.gradeDot, { backgroundColor: gradeColor }]} />
                <Text style={[styles.gradeText, { color: gradeColor }]}>{grade.grade}</Text>
              </View>
            )}

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              onPress={() => copyHadith(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.iconAction, isCopied && { backgroundColor: accentColor + "22", borderRadius: 8 }]}
            >
              <Icon
                name={isCopied ? "check" : "copy"}
                size={15}
                color={isCopied ? accentColor : colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleBookmark(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.iconAction}
            >
              <Icon
                name="bookmark"
                size={17}
                color={isBookmarked ? colors.goldLight : colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => shareHadith(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.iconAction}
            >
              <Icon name="share-2" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Arabic text */}
          {showArabic && item.arabic ? (
            <View style={[styles.arabicBlock, { borderColor: colors.border }]}>
              <Text style={[styles.arabicText, { color: colors.textPrimary }]}>
                {item.arabic}
              </Text>
            </View>
          ) : null}

          {/* Narrator attribution */}
          {showEnglish && item.narrator ? (
            <Text style={[styles.narratorText, { color: colors.goldLight }]}>
              [{item.narrator}]
            </Text>
          ) : null}

          {/* English / translated body */}
          {showEnglish && (
            <>
              {translating && !translatedBody && selectedLang.code !== "en" ? (
                <View style={styles.transLoadRow}>
                  <ActivityIndicator size="small" color={colors.textMuted} />
                  <Text style={[styles.transLoadText, { color: colors.textMuted }]}>
                    Translating…
                  </Text>
                </View>
              ) : (
                <Text
                  style={[styles.hadithText, { color: colors.textSecondary }]}
                  onLayout={() => handleHadithRead(item)}
                >
                  {truncated}
                </Text>
              )}
              {isLong && (
                <TouchableOpacity
                  onPress={() => setExpandedId(isExpanded ? null : item.hadithnumber)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={[styles.readMore, { color: bookColor === "#1a4a2e" ? "#4ade80" : colors.goldLight }]}>
                    {isExpanded ? "Show less ↑" : "Read more ↓"}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Reference */}
          {item.reference ? (
            <Text style={[styles.reference, { color: colors.textMuted }]}>
              {item.reference}
            </Text>
          ) : null}
        </View>
      );
    },
    [bookmarks, expandedId, colors, bookMeta, translations, showArabic, showEnglish, translating, awardedXpIds, copiedId, selectedLang.code, accentColor]
  );

  if (!bookMeta) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.textMuted }}>Book not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.background === "#0a0a0a" ? "light-content" : "dark-content"} />

      {/* Header — matches Quran screen style */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (isWeb ? 67 : 0) + 8,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surfaceHigh }]}
        >
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.headerMid}>
          <Text style={[styles.headerArabic, { color: colors.goldLight }]} numberOfLines={1}>
            {bookMeta.arabicName}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {bookMeta.name} · {allHadiths.length > 0 ? allHadiths.length.toLocaleString() : bookMeta.total.toLocaleString()} hadiths
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            setSearchActive((v) => !v);
            if (!searchActive) setTimeout(() => searchRef.current?.focus(), 100);
            else setSearchQuery("");
          }}
          style={[styles.iconBtn, { backgroundColor: colors.surfaceHigh }]}
        >
          <Icon name={searchActive ? "x" : "search"} size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Controls bar */}
      <View style={[styles.controls, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => {
            const next = !showArabic;
            setShowArabic(next);
            AsyncStorage.setItem(SHOW_ARABIC_KEY, String(next));
          }}
          style={[styles.ctrlBtn, { backgroundColor: showArabic ? accentColor + "22" : colors.surfaceHigh, borderColor: showArabic ? accentColor + "55" : colors.border }]}
        >
          <Text style={[styles.ctrlBtnText, { color: showArabic ? accentColor : colors.textMuted }]}>عر</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            const next = !showEnglish;
            setShowEnglish(next);
            AsyncStorage.setItem(SHOW_EN_KEY, String(next));
          }}
          style={[styles.ctrlBtn, { backgroundColor: showEnglish ? accentColor + "22" : colors.surfaceHigh, borderColor: showEnglish ? accentColor + "55" : colors.border }]}
        >
          <Text style={[styles.ctrlBtnText, { color: showEnglish ? accentColor : colors.textMuted }]}>
            {selectedLang.code.toUpperCase()}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setLangModal(true)}
          style={[styles.langBtn, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}
        >
          <Icon name="globe" size={14} color={colors.textSecondary} />
          <Text style={[styles.langBtnText, { color: colors.textSecondary }]} numberOfLines={1}>
            {selectedLang.name}
          </Text>
          <Icon name="chevron-down" size={13} color={colors.textMuted} />
        </Pressable>

        <View style={{ flex: 1 }} />

        <View style={[styles.statsChip, { backgroundColor: colors.surfaceHigh }]}>
          <Icon name="book-open" size={12} color={colors.textMuted} />
          <Text style={[styles.statsText, { color: colors.textMuted }]}>
            {awardedXpIds.size} read
          </Text>
        </View>
      </View>

      {/* Search bar */}
      {searchActive && (
        <View style={[styles.searchRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={[styles.searchWrap, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
            <Icon name="search" size={15} color={colors.textMuted} />
            <TextInput
              ref={searchRef}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder={`Search in ${bookMeta.name}…`}
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          {searchQuery.length > 0 && (
            <Text style={[styles.searchCount, { color: colors.textMuted }]}>
              {filteredHadiths.length} result{filteredHadiths.length !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
      )}

      {/* Book info banner */}
      {!searchActive && (
        <View style={[styles.bookBanner, { backgroundColor: bookColor + "12", borderColor: bookColor + "30" }]}>
          <View style={styles.bookBannerLeft}>
            <Text style={[styles.bookBannerArabic, { color: colors.textPrimary }]}>{bookMeta.arabicName}</Text>
            <Text style={[styles.bookBannerAuthor, { color: accentColor }]}>{bookMeta.author}</Text>
          </View>
          <Text style={[styles.bookBannerDesc, { color: colors.textSecondary }]} numberOfLines={3}>
            {bookMeta.description}
          </Text>
        </View>
      )}

      {/* States */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading hadiths…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Icon name="wifi-off" size={40} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
          <TouchableOpacity
            onPress={loadHadiths}
            style={[styles.retryBtn, { backgroundColor: accentColor + "20", borderColor: accentColor + "40" }]}
          >
            <Text style={[styles.retryText, { color: accentColor }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayData}
          renderItem={renderHadith}
          keyExtractor={(item) => String(item.hadithnumber)}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + PLAYER_BAR_HEIGHT + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="search" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {searchQuery ? `No results for "${searchQuery}"` : "No hadiths found"}
              </Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={[styles.loadMoreBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={loadMore}
              >
                <Text style={[styles.loadMoreText, { color: accentColor }]}>
                  Load more ({(filteredHadiths.length - displayCount).toLocaleString()} remaining)
                </Text>
              </TouchableOpacity>
            ) : allHadiths.length > 0 ? (
              <View style={styles.footerEnd}>
                <Icon name="check-circle" size={16} color={colors.textMuted} />
                <Text style={[styles.footerText, { color: colors.textMuted }]}>
                  All {allHadiths.length.toLocaleString()} hadiths loaded
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Language Modal */}
      <Modal visible={langModal} transparent animationType="slide" onRequestClose={() => setLangModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setLangModal(false)}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Translation Language</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {TRANSLATE_LANGS.map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => handleLangSelect(lang)}
                  style={[
                    styles.langRow,
                    {
                      backgroundColor:
                        selectedLang.code === lang.code ? accentColor + "15" : "transparent",
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.langRowName, { color: colors.textPrimary }]}>{lang.name}</Text>
                    <Text style={[styles.langRowNative, { color: colors.textMuted }]}>{lang.nativeName}</Text>
                  </View>
                  {selectedLang.code === lang.code && (
                    <Icon name="check" size={16} color={accentColor} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMid: { flex: 1, alignItems: "center" },
  headerArabic: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  headerTitle: { fontSize: 12, marginTop: 2, textAlign: "center" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  ctrlBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtnText: { fontSize: 13, fontWeight: "700" },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
  },
  langBtnText: { fontSize: 12, fontWeight: "500", maxWidth: 80 },
  statsChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  statsText: { fontSize: 11 },
  searchRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 9 : 7,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  searchCount: { fontSize: 12, textAlign: "right" },
  bookBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 2,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: "row",
    gap: 12,
  },
  bookBannerLeft: { width: 110 },
  bookBannerArabic: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  bookBannerAuthor: { fontSize: 11, fontWeight: "600" },
  bookBannerDesc: { flex: 1, fontSize: 11, lineHeight: 17 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  retryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { fontSize: 14, fontWeight: "600" },
  list: { paddingHorizontal: 14, paddingTop: 10, gap: 10 },
  hadithCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  numBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 38,
    alignItems: "center",
  },
  numText: { fontSize: 12, fontWeight: "700" },
  gradeBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
  },
  gradeDot: { width: 5, height: 5, borderRadius: 3 },
  gradeText: { fontSize: 11, fontWeight: "600" },
  iconAction: { padding: 4 },
  arabicBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  arabicText: {
    fontSize: 18,
    lineHeight: 36,
    fontFamily: Platform.OS === "ios" ? "System" : undefined,
    textAlign: "right",
    writingDirection: "rtl",
    letterSpacing: 0.5,
  },
  narratorText: {
    fontSize: 12,
    fontWeight: "600",
    fontStyle: "italic",
    lineHeight: 18,
  },
  hadithText: { fontSize: 14, lineHeight: 24 },
  transLoadRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  transLoadText: { fontSize: 13 },
  readMore: { fontSize: 13, fontWeight: "600" },
  reference: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, textAlign: "center" },
  loadMoreBtn: {
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    alignItems: "center",
  },
  loadMoreText: { fontSize: 14, fontWeight: "600" },
  footerEnd: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 24,
  },
  footerText: { fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "75%",
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  langRowName: { fontSize: 15, fontWeight: "500" },
  langRowNative: { fontSize: 12, marginTop: 1 },
});
