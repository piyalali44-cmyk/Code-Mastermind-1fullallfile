import { Icon } from "@/components/Icon";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAudio } from "@/context/AudioContext";
import { useAuth } from "@/context/AuthContext";
import { SURAHS } from "@/constants/surahs";
import { RECITERS } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

const QURAN_TRANSLATION_KEY = "quran_translation_edition";
const AYAH_BOOKMARKS_KEY = "quran_ayah_bookmarks_v1";
const DEFAULT_EDITION = "en.sahih";

const LANG_CODE_TO_NAME: Record<string, string> = {
  en: "English", fr: "French", ur: "Urdu", ar: "Arabic", tr: "Turkish",
  id: "Indonesian", de: "German", es: "Spanish", it: "Italian", nl: "Dutch",
  pt: "Portuguese", ru: "Russian", zh: "Chinese", ja: "Japanese", ko: "Korean",
  hi: "Hindi", bn: "Bengali", fa: "Persian", ms: "Malay", th: "Thai",
  sw: "Swahili", ha: "Hausa", sq: "Albanian", az: "Azerbaijani", bs: "Bosnian",
  ku: "Kurdish", ml: "Malayalam", ta: "Tamil", te: "Telugu", tg: "Tajik",
  tt: "Tatar", ug: "Uyghur", uz: "Uzbek", am: "Amharic", so: "Somali",
  dv: "Divehi", no: "Norwegian", sv: "Swedish", pl: "Polish", cs: "Czech",
  ro: "Romanian", bg: "Bulgarian", mk: "Macedonian",
};

interface Ayah {
  number: number;
  numberInSurah: number;
  arabic: string;
  translation: string;
}

interface TranslationEdition {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
}

const DEMO_AYAHS: Record<number, Ayah[]> = {
  1: [
    { number: 1, numberInSurah: 1, arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", translation: "In the name of Allah, the Entirely Merciful, the Especially Merciful." },
    { number: 2, numberInSurah: 2, arabic: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", translation: "All praise is due to Allah, Lord of the worlds —" },
    { number: 3, numberInSurah: 3, arabic: "الرَّحْمَٰنِ الرَّحِيمِ", translation: "The Entirely Merciful, the Especially Merciful," },
    { number: 4, numberInSurah: 4, arabic: "مَالِكِ يَوْمِ الدِّينِ", translation: "Sovereign of the Day of Recompense." },
    { number: 5, numberInSurah: 5, arabic: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", translation: "It is You we worship and You we ask for help." },
    { number: 6, numberInSurah: 6, arabic: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ", translation: "Guide us to the straight path —" },
    { number: 7, numberInSurah: 7, arabic: "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ", translation: "The path of those upon whom You have bestowed favor, not of those who have earned anger or of those who are astray." },
  ],
};

export default function SurahDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { play, nowPlaying, isPlaying, pause, resume } = useAudio();
  const { user } = useAuth();
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArabic, setShowArabic] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [selectedReciter, setSelectedReciter] = useState("Mishary Rashid Alafasy");
  const [translationEdition, setTranslationEdition] = useState(DEFAULT_EDITION);
  const [selectedLangName, setSelectedLangName] = useState("English");
  const [langModal, setLangModal] = useState(false);
  const [reciterModal, setReciterModal] = useState(false);
  const [editions, setEditions] = useState<TranslationEdition[]>([]);
  const [loadingEditions, setLoadingEditions] = useState(false);
  const [ayahBookmarks, setAyahBookmarks] = useState<Set<number>>(new Set());
  const isWeb = Platform.OS === "web";

  const surahNum = parseInt(id ?? "1", 10);
  const surah = SURAHS.find((s) => s.number === surahNum) ?? SURAHS[0];
  const isCurrentSurah = nowPlaying?.surahNumber === surahNum;

  useEffect(() => {
    AsyncStorage.getItem(QURAN_TRANSLATION_KEY).then((val) => {
      if (val) setTranslationEdition(val);
    });
    AsyncStorage.getItem("quran_translation_lang").then((val) => {
      if (val) setSelectedLangName(val);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(`${AYAH_BOOKMARKS_KEY}_${surahNum}`).then((raw) => {
      if (raw) {
        const nums: number[] = JSON.parse(raw);
        setAyahBookmarks(new Set(nums));
      } else {
        setAyahBookmarks(new Set());
      }
    });
  }, [surahNum]);

  const toggleAyahBookmark = async (ayahNum: number) => {
    const next = new Set(ayahBookmarks);
    if (next.has(ayahNum)) next.delete(ayahNum);
    else next.add(ayahNum);
    setAyahBookmarks(next);
    await AsyncStorage.setItem(`${AYAH_BOOKMARKS_KEY}_${surahNum}`, JSON.stringify([...next]));
  };

  useEffect(() => {
    fetchAyahs();
  }, [surahNum, translationEdition]);

  const fetchAyahs = async () => {
    setLoading(true);
    if (DEMO_AYAHS[surahNum] && translationEdition === DEFAULT_EDITION) {
      setAyahs(DEMO_AYAHS[surahNum]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/editions/quran-uthmani,${translationEdition}`);
      const data = await res.json();
      if (data.code === 200) {
        const arabicAyahs = data.data[0].ayahs;
        const transAyahs = data.data[1].ayahs;
        setAyahs(arabicAyahs.map((a: any, i: number) => ({
          number: a.number,
          numberInSurah: a.numberInSurah,
          arabic: a.text,
          translation: transAyahs[i]?.text ?? "",
        })));
      }
    } catch {
      setAyahs(Array.from({ length: surah.verseCount }, (_, i) => ({
        number: i + 1,
        numberInSurah: i + 1,
        arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        translation: "In the name of Allah, the Entirely Merciful, the Especially Merciful.",
      })));
    } finally {
      setLoading(false);
    }
  };

  const openLangPicker = async () => {
    setLangModal(true);
    if (editions.length > 0) return;
    setLoadingEditions(true);
    try {
      const res = await fetch("https://api.alquran.cloud/v1/edition?format=text&type=translation");
      const data = await res.json();
      if (data.code === 200) {
        setEditions(data.data);
      }
    } catch {
      setEditions([
        { identifier: "en.sahih", language: "English", name: "Saheeh International", englishName: "Saheeh International" },
        { identifier: "en.pickthall", language: "English", name: "Pickthall", englishName: "Pickthall" },
        { identifier: "ur.jalandhry", language: "Urdu", name: "Jalandhry", englishName: "Urdu - Jalandhry" },
        { identifier: "fr.hamidullah", language: "French", name: "Hamidullah", englishName: "French - Hamidullah" },
        { identifier: "id.indonesian", language: "Indonesian", name: "Bahasa Indonesia", englishName: "Indonesian" },
        { identifier: "tr.yazir", language: "Turkish", name: "Elmalili Hamdi Yazir", englishName: "Turkish - Yazir" },
      ]);
    } finally {
      setLoadingEditions(false);
    }
  };

  const resolveLangName = (lang: string) => LANG_CODE_TO_NAME[lang.toLowerCase()] ?? LANG_CODE_TO_NAME[lang.substring(0, 2).toLowerCase()] ?? lang;

  const selectEdition = async (identifier: string, language: string) => {
    const fullName = resolveLangName(language);
    setTranslationEdition(identifier);
    setSelectedLangName(fullName);
    await AsyncStorage.setItem(QURAN_TRANSLATION_KEY, identifier);
    await AsyncStorage.setItem("quran_translation_lang", fullName);
    setLangModal(false);
  };

  const selectedEditionName = editions.find((e) => e.identifier === translationEdition)?.englishName ?? translationEdition;

  const RECITER_AUDIO_MAP: Record<string, string> = {
    "Mishary Rashid Alafasy": "ar.alafasy",
    "Abdul Rahman Al-Sudais": "ar.abdurrahmaansudais",
    "Mahmoud Khalil Al-Hussary": "ar.husary",
    "Saud Al-Shuraim": "ar.shuraim",
    "Abdul Basit Abdus Samad": "ar.abdulbasitmurattal",
  };

  const handlePlaySurah = async () => {
    if (isCurrentSurah) {
      isPlaying ? await pause() : await resume();
      return;
    }
    const reciterSlug = RECITER_AUDIO_MAP[selectedReciter] ?? "ar.alafasy";
    router.push("/player");
    await play({
      id: `surah_${surahNum}_${reciterSlug}`,
      title: surah.nameSimple,
      seriesName: `Surah ${surahNum} · ${selectedReciter}`,
      coverColor: colors.green,
      audioUrl: `https://cdn.islamic.network/quran/audio-surah/128/${reciterSlug}/${surahNum}.mp3`,
      type: "quran",
      surahNumber: surahNum,
    }, user?.id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 8, backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerMid}>
          <Text style={[styles.surahNameArabic, { color: colors.goldLight }]}>{surah.nameArabic}</Text>
          <Text style={[styles.surahNameSimple, { color: colors.textSecondary }]}>{surah.nameSimple} · {surah.verseCount} verses</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setShowArabic(!showArabic)} style={styles.hdrBtn}>
            <Text style={[styles.hdrBtnText, { color: showArabic ? colors.goldLight : colors.textMuted }]}>عر</Text>
          </Pressable>
          <Pressable onPress={() => setShowTranslation(!showTranslation)} style={styles.hdrBtn}>
            <Text style={[styles.hdrBtnText, { color: showTranslation ? colors.goldLight : colors.textMuted }]} numberOfLines={1}>{selectedLangName.substring(0, 2).toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>

      {/* Controls */}
      <View style={[styles.controls, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
        <Pressable onPress={handlePlaySurah} style={[styles.playBtn, { backgroundColor: colors.gold }]}>
          <Icon name={isCurrentSurah && isPlaying ? "pause" : "play"} size={16} color="#fff" />
          <Text style={styles.playBtnText}>{isCurrentSurah && isPlaying ? "Pause" : "Play Surah"}</Text>
        </Pressable>
        <Pressable onPress={() => setReciterModal(true)} style={[styles.reciterBtn, { backgroundColor: colors.surfaceHigh }]}>
          <Icon name="user" size={14} color={colors.textSecondary} />
          <Text style={[styles.reciterText, { color: colors.textSecondary }]} numberOfLines={1}>{selectedReciter.split(" ")[0]}</Text>
          <Icon name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={openLangPicker} style={[styles.reciterBtn, { backgroundColor: colors.surfaceHigh }]}>
          <Icon name="globe" size={14} color={colors.textSecondary} />
          <Text style={[styles.reciterText, { color: colors.textSecondary }]} numberOfLines={1}>
            {selectedLangName}
          </Text>
          <Icon name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>Loading surah...</Text>
        </View>
      ) : (
        <FlatList
          data={ayahs}
          keyExtractor={(item) => item.numberInSurah.toString()}
          contentContainerStyle={{ padding: 16, gap: 0, paddingBottom: !!nowPlaying ? 148 : 108 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={[styles.bismillah, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.bismillahText, { color: colors.goldLight }]}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.ayahCard, { borderBottomColor: colors.divider }]}>
              <View style={styles.ayahNumRow}>
                <View style={[styles.ayahNumBadge, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "33" }]}>
                  <Text style={[styles.ayahNum, { color: colors.goldLight }]}>{item.numberInSurah}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <Pressable style={{ padding: 4 }} onPress={() => toggleAyahBookmark(item.numberInSurah)}>
                  <Icon
                    name="bookmark"
                    size={16}
                    color={ayahBookmarks.has(item.numberInSurah) ? colors.goldLight : colors.textMuted}
                  />
                </Pressable>
              </View>
              {showArabic && (
                <Text style={[styles.arabicText, { color: colors.textPrimary }]}>{item.arabic}</Text>
              )}
              {showTranslation && (
                <Text style={[styles.translationText, { color: colors.textSecondary }]}>{item.translation}</Text>
              )}
            </View>
          )}
        />
      )}

      {/* Reciter Picker Modal */}
      <Modal visible={reciterModal} transparent animationType="slide" onRequestClose={() => setReciterModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setReciterModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Choose Reciter</Text>
            {RECITERS.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => { setSelectedReciter(r.name); setReciterModal(false); }}
                style={[styles.editionRow, { backgroundColor: selectedReciter === r.name ? colors.gold + "22" : "transparent" }]}
              >
                <View style={[styles.reciterAvatar, { backgroundColor: selectedReciter === r.name ? colors.gold + "33" : colors.surfaceHigh }]}>
                  <Icon name="user" size={16} color={selectedReciter === r.name ? colors.goldLight : colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editionName, { color: colors.textPrimary }]}>{r.name}</Text>
                  <Text style={[styles.editionLang, { color: colors.textMuted }]}>{r.style}</Text>
                </View>
                {selectedReciter === r.name && <Icon name="check" size={16} color={colors.goldLight} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Language/Translation Picker Modal */}
      <Modal visible={langModal} transparent animationType="slide" onRequestClose={() => setLangModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setLangModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Translation Language</Text>
            {loadingEditions ? (
              <View style={{ padding: 32, alignItems: "center" }}>
                <ActivityIndicator color={colors.gold} />
                <Text style={{ color: colors.textMuted, marginTop: 12 }}>Loading translations...</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {editions.map((ed) => (
                  <Pressable
                    key={ed.identifier}
                    onPress={() => selectEdition(ed.identifier, ed.language)}
                    style={[styles.editionRow, { backgroundColor: translationEdition === ed.identifier ? colors.gold + "22" : "transparent" }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.editionName, { color: colors.textPrimary }]}>{ed.englishName}</Text>
                      <Text style={[styles.editionLang, { color: colors.textMuted }]}>{resolveLangName(ed.language)}</Text>
                    </View>
                    {translationEdition === ed.identifier && <Icon name="check" size={16} color={colors.goldLight} />}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>
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
  headerMid: { flex: 1, alignItems: "center" },
  surahNameArabic: { fontSize: 22 },
  surahNameSimple: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 2 },
  hdrBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  hdrBtnText: { fontSize: 14, fontWeight: "700" },
  controls: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.5,
  },
  playBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: 10,
  },
  playBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  reciterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
  },
  reciterText: { fontSize: 13, maxWidth: 80 },
  bismillah: {
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 8,
    borderBottomWidth: 0.5,
  },
  bismillahText: { fontSize: 22, textAlign: "center" },
  ayahCard: {
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    gap: 10,
  },
  ayahNumRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ayahNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  ayahNum: { fontSize: 12, fontWeight: "600" },
  arabicText: {
    fontSize: 22,
    textAlign: "right",
    lineHeight: 40,
  },
  translationText: {
    fontSize: 14,
    lineHeight: 22,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, gap: 4 },
  modalTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  editionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, gap: 8 },
  editionName: { fontSize: 14, fontWeight: "500" },
  editionLang: { fontSize: 11, marginTop: 2 },
  reciterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  border: { borderColor: "transparent" },
});
