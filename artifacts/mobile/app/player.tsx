import { Icon } from "@/components/Icon";
import { Toast } from "@/components/Toast";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAudio } from "@/context/AudioContext";
import { useAuth } from "@/context/AuthContext";
import { useContent } from "@/context/ContentContext";
import { useUserActions } from "@/context/UserActionsContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { supabase } from "@/lib/supabase";
import {
  toggleContentLike,
  getContentLikeStatus,
  getContentLikeCount,
  getContentComments,
  getContentCommentCount,
  addContentComment,
  softDeleteContentComment,
  type ContentComment,
} from "@/lib/db";
import { SURAHS } from "@/constants/surahs";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/context/ThemeContext";
import FadeImage from "@/components/FadeImage";

const { width: SCREEN_W } = Dimensions.get("window");

interface Ayah {
  number: number;
  numberInSurah: number;
  arabic: string;
  translation: string;
}

const FALLBACK_AYAHS: Ayah[] = [
  { number: 1, numberInSurah: 1, arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", translation: "In the name of Allah, the Entirely Merciful, the Especially Merciful." },
  { number: 2, numberInSurah: 2, arabic: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", translation: "All praise is due to Allah, Lord of the worlds —" },
  { number: 3, numberInSurah: 3, arabic: "الرَّحْمَٰنِ الرَّحِيمِ", translation: "The Entirely Merciful, the Especially Merciful," },
  { number: 4, numberInSurah: 4, arabic: "مَالِكِ يَوْمِ الدِّينِ", translation: "Sovereign of the Day of Recompense." },
  { number: 5, numberInSurah: 5, arabic: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", translation: "It is You we worship and You we ask for help." },
  { number: 6, numberInSurah: 6, arabic: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ", translation: "Guide us to the straight path —" },
  { number: 7, numberInSurah: 7, arabic: "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ", translation: "The path of those upon whom You have bestowed favor, not of those who have earned anger or of those who are astray." },
];

const SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0];
const SLEEP_OPTIONS = ["15 min", "30 min", "45 min", "60 min", "End of episode", "Off"];

const QURAN_TRANSLATION_KEY = "quran_translation_edition";
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

interface TranslationEdition {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
}

function AyahArabicText({ text, style, isActive }: { text: string; style: any; isActive: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isActive) {
      const easing = Easing.inOut(Easing.sin);
      anim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 1600, easing, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.55, duration: 1600, easing, useNativeDriver: true }),
        ])
      );
      anim.current.start();
    } else {
      anim.current?.stop();
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
    return () => { anim.current?.stop(); };
  }, [isActive]);

  return (
    <Animated.Text style={[style, { opacity }]}>
      {text}
    </Animated.Text>
  );
}

function PlayingBarsIcon({ color, size = 18 }: { color: string; size?: number }) {
  const bar1 = useRef(new Animated.Value(size * 0.35)).current;
  const bar2 = useRef(new Animated.Value(size * 0.75)).current;
  const bar3 = useRef(new Animated.Value(size * 0.55)).current;

  useEffect(() => {
    const makeLoop = (anim: Animated.Value, minH: number, maxH: number, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: maxH, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(anim, { toValue: minH, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      );
    const min = size * 0.18;
    const a1 = makeLoop(bar1, min, size * 0.88, 340);
    const a2 = makeLoop(bar2, min, size,        260);
    const a3 = makeLoop(bar3, min, size * 0.72, 410);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [size]);

  const barW = Math.max(2.5, size * 0.13);
  return (
    <View style={{ width: size * 0.6, height: size, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
      {[bar1, bar2, bar3].map((anim, i) => (
        <Animated.View key={i} style={{ width: barW, height: anim, backgroundColor: color, borderRadius: barW / 2 }} />
      ))}
    </View>
  );
}

function ActiveAccentBar({ color }: { color: string }) {
  const opacityBar = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityBar, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(opacityBar, { toValue: 0.4, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={{ width: 3, borderRadius: 2, alignSelf: "stretch", backgroundColor: color, opacity: opacityBar, marginRight: 12 }} />;
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function PlayerScreen() {
  const colors = useColors();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { nowPlaying, isPlaying, isLoading, position, duration, playbackSpeed, repeatMode, setRepeatMode, pause, resume, seek, skipForward, skipBack, setSpeed, play } = useAudio();
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const { isFavourite, isBookmarked: isItemBookmarked, isDownloaded: isItemDownloaded, toggleFavourite, toggleBookmark, toggleDownload } = useUserActions();
  const [speedModal, setSpeedModal] = useState(false);
  const [sleepModal, setSleepModal] = useState(false);
  const [moreModal, setMoreModal] = useState(false);
  const [commentModal, setCommentModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [isDbLiked, setIsDbLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likePending, setLikePending] = useState(false);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [ayahsLoading, setAyahsLoading] = useState(false);
  const [translationEdition, setTranslationEdition] = useState(DEFAULT_EDITION);
  const [selectedLangName, setSelectedLangName] = useState("English");
  const [langModal, setLangModal] = useState(false);
  const [editions, setEditions] = useState<TranslationEdition[]>([]);
  const [loadingEditions, setLoadingEditions] = useState(false);
  const [progressBarWidth, setProgressBarWidth] = useState(300);
  const [toast, setToast] = useState<{ visible: boolean; message: string; icon: any; iconColor?: string }>({ visible: false, message: "", icon: "check" });
  const isWeb = Platform.OS === "web";

  const slideAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const stickyMiniOpacity = useRef(new Animated.Value(0)).current;
  const [showStickyMini, setShowStickyMini] = useState(false);
  const STICKY_THRESHOLD = 220;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const showToast = (message: string, icon: any, iconColor?: string) => {
    setToast({ visible: true, message, icon, iconColor });
  };

  // Load saved translation edition from storage
  useEffect(() => {
    AsyncStorage.getItem(QURAN_TRANSLATION_KEY).then((val) => {
      if (val) setTranslationEdition(val);
    });
    AsyncStorage.getItem("quran_translation_lang").then((val) => {
      if (val) setSelectedLangName(val);
    });
  }, []);

  const resolveLangName = (lang: string) =>
    LANG_CODE_TO_NAME[lang.toLowerCase()] ?? LANG_CODE_TO_NAME[lang.substring(0, 2).toLowerCase()] ?? lang;

  const openLangPicker = useCallback(async () => {
    setLangModal(true);
    if (editions.length > 0) return;
    setLoadingEditions(true);
    try {
      const res = await fetch("https://api.alquran.cloud/v1/edition?format=text&type=translation");
      const data = await res.json();
      if (data.code === 200) setEditions(data.data);
    } catch {
      setEditions([
        { identifier: "en.sahih", language: "en", name: "Saheeh International", englishName: "Saheeh International" },
        { identifier: "en.pickthall", language: "en", name: "Pickthall", englishName: "Pickthall" },
        { identifier: "bn.bengali", language: "bn", name: "Bengali", englishName: "Bengali" },
        { identifier: "ur.jalandhry", language: "ur", name: "Jalandhry", englishName: "Urdu - Jalandhry" },
        { identifier: "fr.hamidullah", language: "fr", name: "Hamidullah", englishName: "French - Hamidullah" },
        { identifier: "id.indonesian", language: "id", name: "Bahasa Indonesia", englishName: "Indonesian" },
        { identifier: "tr.yazir", language: "tr", name: "Elmalili Hamdi Yazir", englishName: "Turkish - Yazir" },
      ]);
    } finally {
      setLoadingEditions(false);
    }
  }, [editions.length]);

  const selectEdition = async (identifier: string, language: string) => {
    const fullName = resolveLangName(language);
    setTranslationEdition(identifier);
    setSelectedLangName(fullName);
    await AsyncStorage.setItem(QURAN_TRANSLATION_KEY, identifier);
    await AsyncStorage.setItem("quran_translation_lang", fullName);
    setLangModal(false);
  };

  // Favourite/Bookmark key — represents the parent content the user wants to save:
  //   surah  → "surah:<number>"    → Library shows Surah row
  //   series → "series:<seriesId>" → Library shows Series card
  const favId = nowPlaying?.surahNumber != null
    ? `surah:${nowPlaying.surahNumber}`
    : nowPlaying?.seriesId
      ? `series:${nowPlaying.seriesId}`
      : (nowPlaying?.id ?? "");

  // Download key — represents the exact audio track (episode or surah) to save:
  //   episode → "episode:<uuid>"   (matches Library Downloads + series/[id] checkmarks)
  //   surah   → "surah:<number>"
  const downloadId = nowPlaying?.surahNumber != null
    ? `surah:${nowPlaying.surahNumber}`
    : nowPlaying?.id
      ? `episode:${nowPlaying.id}`
      : "";

  const isBookmarked = isItemBookmarked(favId);
  const isDownloaded = isItemDownloaded(downloadId);

  const itemMeta = { title: nowPlaying?.title ?? "", coverColor: nowPlaying?.coverColor, audioUrl: nowPlaying?.audioUrl };

  // ─── Content type/id for likes & comments ──────────────────────────────────
  const contentType = nowPlaying?.type === "quran" ? "surah" : "episode";
  const contentId = nowPlaying?.type === "quran"
    ? String(nowPlaying?.surahNumber ?? "")
    : (nowPlaying?.id ?? "");

  // ─── Load likes + comments count when nowPlaying changes ───────────────────
  useEffect(() => {
    if (!contentId) return;
    let cancelled = false;
    const load = async () => {
      const [likeStatus, cCount] = await Promise.all([
        user?.id
          ? getContentLikeStatus(user.id, contentType, contentId)
          : getContentLikeCount(contentType, contentId).then((c) => ({ isLiked: false, count: c })),
        getContentCommentCount(contentType, contentId),
      ]);
      if (!cancelled) {
        setIsDbLiked(likeStatus.isLiked);
        setLikeCount(likeStatus.count);
        setCommentCount(cCount);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [contentId, contentType, user?.id]);

  // ─── Real-time subscription for likes & comments ───────────────────────────
  useEffect(() => {
    if (!contentId) return;
    const channel = supabase
      .channel(`player-${contentType}-${contentId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "content_likes", filter: `content_id=eq.${contentId}` },
        async () => {
          const c = await getContentLikeCount(contentType, contentId);
          setLikeCount(c);
          if (user?.id) {
            const s = await getContentLikeStatus(user.id, contentType, contentId);
            setIsDbLiked(s.isLiked);
          }
        },
      )
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "content_comments", filter: `content_id=eq.${contentId}` },
        async (payload: any) => {
          setCommentCount((n) => n + 1);
          if (commentModal) {
            const { comments: fresh } = await getContentComments(contentType, contentId, user?.id);
            setComments(fresh);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [contentId, contentType, user?.id, commentModal]);

  // ─── Like handler (DB-backed) ───────────────────────────────────────────────
  const handleLike = async () => {
    if (!user?.id) { showToast("Sign in to like", "heart", colors.textSecondary); return; }
    if (likePending) return;
    setLikePending(true);
    const optimistic = !isDbLiked;
    setIsDbLiked(optimistic);
    setLikeCount((n) => n + (optimistic ? 1 : -1));
    try {
      const { liked } = await toggleContentLike(user.id, contentType, contentId);
      setIsDbLiked(liked);
      showToast(liked ? "Liked!" : "Like removed", "heart", liked ? colors.gold : colors.textSecondary);
    } catch {
      setIsDbLiked(!optimistic);
      setLikeCount((n) => n + (optimistic ? -1 : 1));
    } finally {
      setLikePending(false);
    }
  };

  // ─── Comment handlers ──────────────────────────────────────────────────────
  const handleOpenComments = async () => {
    setCommentModal(true);
    setCommentsLoading(true);
    const { comments: list } = await getContentComments(contentType, contentId, user?.id);
    setComments(list);
    setCommentsLoading(false);
  };

  const handleAddComment = async () => {
    if (!user?.id) { showToast("Sign in to comment", "message-circle", colors.textSecondary); return; }
    const text = commentText.trim();
    if (!text || text.length > 500) return;
    setSendingComment(true);
    const newComment = await addContentComment(user.id, contentType, contentId, text);
    if (newComment) {
      setComments((prev) => [...prev, newComment]);
      setCommentCount((n) => n + 1);
      setCommentText("");
    }
    setSendingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const ok = await softDeleteContentComment(commentId);
    if (ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentCount((n) => Math.max(0, n - 1));
    }
  };

  const handleBookmark = () => {
    const added = toggleBookmark(favId, itemMeta);
    showToast(added ? "Bookmarked" : "Bookmark Removed", "bookmark", added ? colors.gold : colors.textSecondary);
  };

  const handleDownload = () => {
    if (settings.subscription_enabled && !user?.isPremium) {
      showToast("Premium required for downloads", "lock", colors.gold);
      setTimeout(() => router.push("/subscription"), 1200);
      return;
    }
    const added = toggleDownload(downloadId, itemMeta);
    showToast(
      added ? "Added to Downloads" : "Removed from Downloads",
      added ? "check-circle" : "download",
      added ? colors.green : colors.textSecondary,
    );
  };

  // Estimate which ayah is currently playing based on playback position
  const currentAyahIdx =
    duration > 0 && ayahs.length > 0 && isPlaying
      ? Math.min(Math.floor((position / duration) * ayahs.length), ayahs.length - 1)
      : -1;

  // Fetch surah text when playing Qur'an or when translation changes
  useEffect(() => {
    if (nowPlaying?.type !== "quran" || !nowPlaying.surahNumber) return;
    const surahNum = nowPlaying.surahNumber;
    setAyahsLoading(true);
    setAyahs([]);
    fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/editions/quran-uthmani,${translationEdition}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.data?.[0]?.ayahs && data?.data?.[1]?.ayahs) {
          const arabic = data.data[0].ayahs;
          const trans = data.data[1].ayahs;
          const merged: Ayah[] = arabic.map((a: any, i: number) => ({
            number: a.number,
            numberInSurah: a.numberInSurah,
            arabic: a.text,
            translation: trans[i]?.text ?? "",
          }));
          setAyahs(merged);
        } else {
          setAyahs(surahNum === 1 ? FALLBACK_AYAHS : []);
        }
      })
      .catch(() => setAyahs(surahNum === 1 ? FALLBACK_AYAHS : []))
      .finally(() => setAyahsLoading(false));
  }, [nowPlaying?.surahNumber, nowPlaying?.type, translationEdition]);

  const progress = duration > 0 ? position / duration : 0;

  const isQuran = nowPlaying?.type === "quran";
  const surahNum = nowPlaying?.surahNumber ?? 1;

  const { series: allSeries } = useContent();

  const currentSeries = nowPlaying?.seriesId
    ? allSeries.find((s) => s.id === nowPlaying.seriesId)
    : allSeries.find((s) => s.episodes.some((ep) => ep.id === nowPlaying?.id));

  const currentEpIndex = nowPlaying?.episodeIndex ?? (
    currentSeries ? currentSeries.episodes.findIndex((ep) => ep.id === nowPlaying?.id) : -1
  );
  const safeEpIndex = currentEpIndex >= 0 ? currentEpIndex : 0;
  const seriesEpisodes = currentSeries?.episodes ?? [];
  const nextEpisodes = currentSeries
    ? currentSeries.episodes.slice(safeEpIndex + 1, safeEpIndex + 6)
    : [];
  const prevEp = currentSeries && safeEpIndex > 0 ? currentSeries.episodes[safeEpIndex - 1] : null;
  const nextEp = nextEpisodes.length > 0 ? nextEpisodes[0] : null;

  const canGoPrev = isQuran ? surahNum > 1 : !!prevEp;
  const canGoNext = isQuran ? surahNum < 114 : !!nextEp;

  const handlePrevTrack = async () => {
    if (isQuran && surahNum > 1) {
      const prevSurahNum = surahNum - 1;
      const prevSurah = SURAHS.find((s) => s.number === prevSurahNum);
      if (prevSurah) {
        await play({
          id: `surah_${prevSurahNum}`,
          title: prevSurah.nameSimple,
          seriesName: `Surah ${prevSurahNum}`,
          coverColor: colors.green,
          audioUrl: `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${prevSurahNum}.mp3`,
          type: "quran",
          surahNumber: prevSurahNum,
        }, user?.id);
      }
    } else if (prevEp && currentSeries) {
      await play({
        id: prevEp.id,
        title: prevEp.title,
        seriesName: currentSeries.title,
        episodeNum: `Episode ${prevEp.number}`,
        coverColor: currentSeries.coverColor,
        coverUrl: prevEp.coverUrl || currentSeries.coverUrl,
        audioUrl: prevEp.audioUrl,
        type: "story",
        seriesId: currentSeries.id,
        episodeIndex: safeEpIndex - 1,
      }, user?.id);
    }
  };

  const handleNextTrack = async () => {
    if (isQuran && surahNum < 114) {
      const nextSurahNum = surahNum + 1;
      const nextSurah = SURAHS.find((s) => s.number === nextSurahNum);
      if (nextSurah) {
        await play({
          id: `surah_${nextSurahNum}`,
          title: nextSurah.nameSimple,
          seriesName: `Surah ${nextSurahNum}`,
          coverColor: colors.green,
          audioUrl: `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${nextSurahNum}.mp3`,
          type: "quran",
          surahNumber: nextSurahNum,
        }, user?.id);
      }
    } else if (nextEp && currentSeries) {
      if (settings.subscription_enabled && nextEp.isPremium && !user?.isPremium) {
        showToast("This episode requires a Premium subscription", "lock", colors.gold);
        setTimeout(() => router.push("/subscription"), 1200);
        return;
      }
      await play({
        id: nextEp.id,
        title: nextEp.title,
        seriesName: currentSeries.title,
        episodeNum: `Episode ${nextEp.number}`,
        coverColor: currentSeries.coverColor,
        coverUrl: nextEp.coverUrl || currentSeries.coverUrl,
        audioUrl: nextEp.audioUrl,
        type: "story",
        seriesId: currentSeries.id,
        episodeIndex: safeEpIndex + 1,
      }, user?.id);
    }
  };

  if (!nowPlaying) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={{ color: colors.textSecondary, marginTop: 16, fontSize: 15 }}>Loading...</Text>
      </View>
    );
  }

  const handleSeek = (tapX: number) => {
    if (duration > 0 && progressBarWidth > 0) {
      const newPos = Math.max(0, Math.min(1, tapX / progressBarWidth)) * duration;
      seek(newPos);
    }
  };

  const screenH = Dimensions.get("window").height;

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeAnim, transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, screenH * 0.15] }) }] }]}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        icon={toast.icon}
        iconColor={toast.iconColor}
        onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
      />
      {/* Sticky AppBar */}
      <View style={[styles.appBar, { paddingTop: insets.top + (isWeb ? 67 : 0), backgroundColor: colors.background, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="chevron-down" size={26} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.appBarCenter}>
          <Text style={[styles.seriesLabel, { color: colors.textSecondary }]} numberOfLines={1}>{nowPlaying.seriesName}</Text>
        </View>
        <Pressable onPress={() => setMoreModal(true)} style={styles.backBtn}>
          <Icon name="more-horizontal" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Sticky Mini Player - shows when scrolled past cover art */}
      {showStickyMini && (
        <Animated.View
          style={{
            position: "absolute",
            top: insets.top + (isWeb ? 67 : 0) + 52,
            left: 0,
            right: 0,
            zIndex: 100,
            opacity: stickyMiniOpacity,
            paddingHorizontal: 12,
          }}
        >
          <View style={[{
            backgroundColor: colors.surfaceHigh,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 10,
            overflow: "hidden",
          }]}>
            {nowPlaying.coverColor && theme === "dark" && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: nowPlaying.coverColor + "30" }]} />
            )}
            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surfaceExtraHigh, alignItems: "center", justifyContent: "center" }}>
              <Icon name={nowPlaying.type === "quran" ? "book-open" : "headphones"} size={16} color={colors.goldLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>{nowPlaying.title}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{nowPlaying.seriesName}</Text>
            </View>
            <Pressable onPress={() => isPlaying ? pause() : resume()} style={[{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }]} hitSlop={8}>
              <Icon name={isPlaying ? "pause" : "play"} size={16} color="#fff" />
            </Pressable>
          </View>
        </Animated.View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 108 }}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const shouldShow = y > STICKY_THRESHOLD;
          if (shouldShow !== showStickyMini) {
            setShowStickyMini(shouldShow);
            Animated.timing(stickyMiniOpacity, {
              toValue: shouldShow ? 1 : 0,
              duration: 200,
              useNativeDriver: true,
            }).start();
          }
        }}
        scrollEventThrottle={16}
      >
        {/* Cover Art */}
        <View style={styles.coverWrap}>
          <View style={[styles.cover, { backgroundColor: nowPlaying.coverColor || colors.surfaceHigh }]}>
            {nowPlaying.coverUrl ? (
              /* ── Real cover image (series / stories) ── */
              <>
                <FadeImage uri={nowPlaying.coverUrl} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
                {/* Subtle gradient at bottom so title reads well */}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.55)"]}
                  style={styles.coverGrad}
                />
              </>
            ) : isQuran ? (
              /* ── Beautiful Quran placeholder ── */
              <>
                {/* Rich multi-tone gradient background */}
                <LinearGradient
                  colors={["#071810", "#0d3322", "#15803D", "#0d3322", "#071810"]}
                  locations={[0, 0.25, 0.5, 0.75, 1]}
                  start={{ x: 0.3, y: 0 }}
                  end={{ x: 0.7, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* Decorative corner rings */}
                <View style={[styles.coverDecorCircle1, { borderColor: colors.goldLight + "25" }]} />
                <View style={[styles.coverDecorCircle2, { borderColor: colors.goldLight + "18" }]} />
                {/* Large faint center ring ornament */}
                <View style={styles.coverCenterRing} />
                {/* Bottom dark fade */}
                <LinearGradient
                  colors={["transparent", "rgba(4,12,8,0.7)"]}
                  style={styles.coverGrad}
                />
                {/* Bismillah */}
                <Text style={styles.coverBismillah}>﷽</Text>
                {/* Arabic surah name */}
                <Text style={styles.coverArabicLarge}>
                  {SURAHS.find((s) => s.number === surahNum)?.nameArabic}
                </Text>
                {/* Gold divider */}
                <View style={styles.coverDivider} />
                {/* English name only — no number */}
                <Text style={styles.coverSurahEn}>
                  {SURAHS.find((s) => s.number === surahNum)?.nameSimple}
                </Text>
              </>
            ) : (
              /* ── Generic audio placeholder ── */
              <>
                <View style={[styles.coverDecorCircle1, { borderColor: (nowPlaying.coverColor || colors.surfaceHigh) + "44" }]} />
                <View style={[styles.coverDecorCircle2, { borderColor: colors.gold + "22" }]} />
                <LinearGradient
                  colors={["transparent", (nowPlaying.coverColor || colors.surfaceHigh)]}
                  style={styles.coverGrad}
                />
                <Icon name="headphones" size={72} color={colors.goldLight} style={{ opacity: 0.85 }} />
              </>
            )}
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleWrap}>
          <Text style={[styles.episodeTitle, { color: colors.textPrimary }]} numberOfLines={2}>{nowPlaying.title}</Text>
          {nowPlaying.episodeNum && (
            <Text style={[styles.episodeMeta, { color: colors.textSecondary }]}>{nowPlaying.episodeNum}</Text>
          )}
        </View>

        {/* Actions Row */}
        <View style={styles.actionsRow}>
          <Pressable onPress={handleLike} style={styles.actionBtnWithCount}>
            <Icon name="heart" size={22} color={isDbLiked ? colors.gold : colors.textSecondary} />
            {likeCount > 0 && (
              <Text style={[styles.actionBtnCount, { color: isDbLiked ? colors.gold : colors.textSecondary }]}>
                {likeCount > 999 ? `${Math.floor(likeCount / 1000)}k` : likeCount}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={handleOpenComments} style={styles.actionBtnWithCount}>
            <Icon name="message-circle" size={22} color={colors.textSecondary} />
            {commentCount > 0 && (
              <Text style={[styles.actionBtnCount, { color: colors.textSecondary }]}>
                {commentCount > 999 ? `${Math.floor(commentCount / 1000)}k` : commentCount}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={handleBookmark} style={styles.actionBtn}>
            <Icon name="bookmark" size={22} color={isBookmarked ? colors.gold : colors.textSecondary} />
          </Pressable>
          <Pressable onPress={handleDownload} style={styles.actionBtn}>
            <Icon name={isDownloaded ? "check-circle" : "download"} size={22} color={isDownloaded ? colors.green : colors.textSecondary} />
          </Pressable>
          <Pressable onPress={() => setSleepModal(true)} style={styles.actionBtn}>
            <Icon name="moon" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View
            style={[styles.progressBarBg, { backgroundColor: colors.divider }]}
            onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onResponderRelease={(e) => handleSeek(e.nativeEvent.locationX)}
          >
            <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: colors.gold }]} />
            <View style={[styles.progressKnob, { left: `${progress * 100}%`, backgroundColor: colors.gold }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(position)}</Text>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(duration)}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <Pressable
            onPress={handlePrevTrack}
            style={[styles.ctrlBtn, { opacity: canGoPrev ? 1 : 0.3 }]}
            disabled={!canGoPrev}
          >
            <Icon name="skip-back" size={26} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={() => skipBack()} style={[styles.skipBtn, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
            <Text style={[styles.skipNum, { color: colors.textPrimary }]}>10</Text>
            <Icon name="rotate-ccw" size={14} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => (isPlaying ? pause() : resume())}
            style={[styles.playBtn, { backgroundColor: colors.gold }]}
            disabled={isLoading}
          >
            <Icon name={isPlaying ? "pause" : "play"} size={30} color="#fff" />
          </Pressable>
          <Pressable onPress={() => skipForward()} style={[styles.skipBtn, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
            <Icon name="rotate-cw" size={14} color={colors.textSecondary} />
            <Text style={[styles.skipNum, { color: colors.textPrimary }]}>10</Text>
          </Pressable>
          <Pressable
            onPress={handleNextTrack}
            style={[styles.ctrlBtn, { opacity: canGoNext ? 1 : 0.3 }]}
            disabled={!canGoNext}
          >
            <Icon name="skip-forward" size={26} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Speed Row */}
        <View style={styles.speedRow}>
          <Pressable onPress={() => setSpeedModal(true)} style={[styles.speedPill, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
            <Text style={[styles.speedText, { color: colors.textPrimary }]}>{playbackSpeed}×</Text>
          </Pressable>
          <Pressable
            onPress={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")}
            style={[
              styles.speedPill,
              {
                backgroundColor: repeatMode !== "off" ? colors.gold + "18" : colors.surfaceHigh,
                borderColor: repeatMode !== "off" ? colors.gold + "44" : colors.border,
              },
            ]}
          >
            <Icon name="repeat" size={14} color={repeatMode !== "off" ? colors.goldLight : colors.textSecondary} />
            <Text style={[styles.speedText, { color: repeatMode !== "off" ? colors.goldLight : colors.textSecondary }]}>
              {repeatMode === "off" ? "Repeat" : repeatMode === "all" ? "Repeat All" : "Repeat 1"}
            </Text>
          </Pressable>
        </View>

        {/* Quran: Surah text | Story: Next Episodes */}
        {nowPlaying.type === "quran" ? (
          <View style={styles.surahSection}>
            {/* Surah header */}
            {nowPlaying.surahNumber && (() => {
              const surah = SURAHS.find((s) => s.number === nowPlaying.surahNumber);
              return (
                <View style={[styles.surahHeaderCard, { borderBottomColor: colors.divider }]}>
                  <Text style={[styles.surahCardArabic, { color: colors.goldLight }]}>{surah?.nameArabic}</Text>
                  <Text style={[styles.surahCardEnglish, { color: colors.textPrimary }]}>{surah?.nameSimple}</Text>
                  <Text style={[styles.surahCardMeta, { color: colors.textSecondary }]}>
                    {surah?.verseCount} verses · {surah?.revelationType}
                  </Text>
                  <Pressable
                    onPress={openLangPicker}
                    style={[styles.translationBtn, { backgroundColor: colors.gold + "18", borderColor: colors.gold + "44" }]}
                  >
                    <Icon name="globe" size={13} color={colors.goldLight} />
                    <Text style={[styles.translationBtnText, { color: colors.goldLight }]}>
                      {selectedLangName} translation
                    </Text>
                    <Icon name="chevron-down" size={13} color={colors.goldLight} />
                  </Pressable>
                </View>
              );
            })()}

            {/* Ayahs */}
            {ayahsLoading && (
              <View style={styles.ayahsLoading}>
                <ActivityIndicator color={colors.gold} size="small" />
                <Text style={[styles.ayahsLoadingText, { color: colors.textMuted }]}>Loading surah...</Text>
              </View>
            )}
            {!ayahsLoading && ayahs.map((ayah, idx) => {
              const isActive = idx === currentAyahIdx;
              return (
                <View
                  key={ayah.number}
                  style={[
                    styles.ayahCard,
                    { borderBottomColor: colors.divider },
                    isActive && { backgroundColor: colors.gold + "0C", borderRadius: 12, paddingHorizontal: 10 },
                  ]}
                >
                  {/* Row: accent bar + content */}
                  <View style={{ flexDirection: "row", alignItems: "stretch" }}>
                    {isActive && <ActiveAccentBar color={colors.goldLight} />}
                    <View style={{ flex: 1, gap: 10 }}>
                      {/* Number badge + volume icon */}
                      <View style={styles.ayahNumRow}>
                        <View
                          style={[
                            styles.ayahNumBadge,
                            {
                              backgroundColor: isActive ? colors.gold + "33" : colors.gold + "18",
                              borderColor: isActive ? colors.gold + "88" : colors.gold + "33",
                            },
                          ]}
                        >
                          <Text style={[styles.ayahNum, { color: colors.goldLight }]}>{ayah.numberInSurah}</Text>
                        </View>
                        {isActive && (
                          <View style={styles.activeDot}>
                            <Icon name="volume-2" size={13} color={colors.goldLight} />
                          </View>
                        )}
                      </View>
                      {/* Arabic text with breathing animation */}
                      <AyahArabicText
                        text={ayah.arabic}
                        isActive={isActive}
                        style={[
                          styles.ayahArabic,
                          { color: isActive ? colors.goldLight : colors.textPrimary },
                        ]}
                      />
                      {/* Translation */}
                      <Text style={[styles.ayahTranslation, { color: isActive ? colors.textPrimary : colors.textSecondary }]}>
                        {ayah.translation}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
            {!ayahsLoading && ayahs.length === 0 && (
              <View style={styles.noNext}>
                <Icon name="book-open" size={32} color={colors.textMuted} />
                <Text style={[styles.noNextText, { color: colors.textMuted }]}>Surah text will appear here</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.nextEpisodesSection}>
            <Text style={[styles.nextEpisodesTitle, { color: colors.textPrimary }]}>Episodes</Text>
            {seriesEpisodes.length === 0 ? (
              <View style={styles.noNext}>
                <Text style={[styles.noNextText, { color: colors.textMuted }]}>No episodes in this series</Text>
              </View>
            ) : (
              seriesEpisodes.map((ep, idx) => {
                const isActive = nowPlaying?.id === ep.id;
                const isLocked = settings.subscription_enabled && ep.isPremium && !user?.isPremium;
                return (
                  <Pressable
                    key={ep.id}
                    onPress={async () => {
                      if (isActive) return;
                      if (isLocked) {
                        showToast("This episode requires a Premium subscription", "lock", colors.gold);
                        setTimeout(() => router.push("/subscription"), 1200);
                        return;
                      }
                      if (!ep.hasAudio) {
                        showToast("Audio coming soon, inshallah! 🌙", "clock", colors.textSecondary);
                        return;
                      }
                      if (currentSeries) {
                        await play({
                          id: ep.id,
                          title: ep.title,
                          seriesName: currentSeries.title,
                          episodeNum: `Episode ${ep.number}`,
                          coverColor: currentSeries.coverColor,
                          coverUrl: ep.coverUrl || currentSeries.coverUrl,
                          audioUrl: ep.audioUrl,
                          type: "story",
                          seriesId: currentSeries.id,
                          episodeIndex: idx,
                        }, user?.id);
                      }
                    }}
                    style={[
                      styles.nextEpCard,
                      {
                        backgroundColor: isActive ? colors.gold + "12" : colors.surface,
                        borderColor: isActive ? colors.gold + "55" : colors.border,
                        opacity: isLocked ? 0.72 : 1,
                      },
                    ]}
                  >
                    <View style={[
                      styles.nextEpCover,
                      { backgroundColor: currentSeries?.coverColor || colors.surfaceHigh },
                    ]}>
                      {isActive
                        ? <PlayingBarsIcon color="#fff" size={16} />
                        : <Icon name="headphones" size={16} color={colors.goldLight} />
                      }
                    </View>
                    <View style={styles.nextEpInfo}>
                      <Text
                        style={[styles.nextEpTitle, { color: isActive ? colors.goldLight : colors.textPrimary, fontWeight: isActive ? "700" : "500" }]}
                        numberOfLines={2}
                      >
                        {ep.title}
                      </Text>
                      <Text style={[styles.nextEpMeta, { color: isActive ? colors.gold + "bb" : colors.textMuted }]}>
                        {isActive ? "Now playing · " : ""}Ep {ep.number} · {ep.duration}
                      </Text>
                    </View>
                    {isActive ? null : settings.subscription_enabled && ep.isPremium ? (
                      <View style={[styles.proTag, { backgroundColor: colors.gold + "22" }]}>
                        <Text style={[styles.proTagText, { color: colors.goldLight }]}>PRO</Text>
                      </View>
                    ) : !ep.hasAudio ? (
                      <View style={[styles.proTag, { backgroundColor: colors.textMuted + "18" }]}>
                        <Text style={[styles.proTagText, { color: colors.textMuted }]}>SOON</Text>
                      </View>
                    ) : (
                      <Icon name="play-circle" size={26} color={colors.gold + "99"} />
                    )}
                  </Pressable>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Speed Modal */}
      <Modal visible={speedModal} transparent animationType="slide" onRequestClose={() => setSpeedModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSpeedModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Playback Speed</Text>
            {SPEEDS.map((s) => (
              <Pressable
                key={s}
                onPress={() => { setSpeed(s); setSpeedModal(false); }}
                style={[styles.speedOption, { backgroundColor: playbackSpeed === s ? colors.gold + "22" : "transparent", justifyContent: "space-between" }]}
              >
                <Text style={[styles.speedOptionText, { color: playbackSpeed === s ? colors.goldLight : colors.textPrimary }]}>{s}×</Text>
                {playbackSpeed === s && <Icon name="check" size={16} color={colors.goldLight} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Sleep Modal */}
      <Modal visible={sleepModal} transparent animationType="slide" onRequestClose={() => setSleepModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSleepModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Sleep Timer</Text>
            {SLEEP_OPTIONS.map((opt) => (
              <Pressable key={opt} onPress={() => setSleepModal(false)} style={styles.speedOption}>
                <Icon name="clock" size={16} color={colors.textSecondary} />
                <Text style={[styles.speedOptionText, { color: colors.textPrimary }]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* More Options Modal */}
      <Modal visible={moreModal} transparent animationType="slide" onRequestClose={() => setMoreModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMoreModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>More Options</Text>
            {currentSeries && (
              <Pressable onPress={() => { setMoreModal(false); router.push(`/series/${currentSeries.id}`); }} style={styles.speedOption}>
                <Icon name="list" size={16} color={colors.textSecondary} />
                <Text style={[styles.speedOptionText, { color: colors.textPrimary }]}>View Series</Text>
              </Pressable>
            )}
            <Pressable onPress={() => { setMoreModal(false); handleLike(); }} style={styles.speedOption}>
              <Icon name="heart" size={16} color={isDbLiked ? colors.gold : colors.textSecondary} />
              <Text style={[styles.speedOptionText, { color: colors.textPrimary }]}>{isDbLiked ? "Unlike" : "Like"}</Text>
            </Pressable>
            <Pressable onPress={() => { setMoreModal(false); handleOpenComments(); }} style={styles.speedOption}>
              <Icon name="message-circle" size={16} color={colors.textSecondary} />
              <Text style={[styles.speedOptionText, { color: colors.textPrimary }]}>Comments{commentCount > 0 ? ` (${commentCount})` : ""}</Text>
            </Pressable>
            <Pressable onPress={() => { setMoreModal(false); handleBookmark(); }} style={styles.speedOption}>
              <Icon name="bookmark" size={16} color={isBookmarked ? colors.gold : colors.textSecondary} />
              <Text style={[styles.speedOptionText, { color: colors.textPrimary }]}>{isBookmarked ? "Remove Bookmark" : "Bookmark"}</Text>
            </Pressable>
            <Pressable onPress={() => { setMoreModal(false); handleDownload(); }} style={styles.speedOption}>
              <Icon name={isDownloaded ? "check-circle" : "download"} size={16} color={isDownloaded ? colors.green : colors.textSecondary} />
              <Text style={[styles.speedOptionText, { color: colors.textPrimary }]}>{isDownloaded ? "Remove Download" : "Download"}</Text>
            </Pressable>
            <Pressable onPress={() => { setMoreModal(false); }} style={styles.speedOption}>
              <Icon name="flag" size={16} color={colors.textSecondary} />
              <Text style={[styles.speedOptionText, { color: colors.textPrimary }]}>Report an Issue</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Comments Modal */}
      <Modal visible={commentModal} transparent animationType="slide" onRequestClose={() => setCommentModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.modalOverlay} onPress={() => setCommentModal(false)}>
            <View
              style={[styles.commentSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onStartShouldSetResponder={() => true}
            >
              {/* Header */}
              <View style={styles.commentHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                  Comments{commentCount > 0 ? ` (${commentCount})` : ""}
                </Text>
                <Pressable onPress={() => setCommentModal(false)}>
                  <Icon name="x" size={20} color={colors.textMuted} />
                </Pressable>
              </View>

              {/* Comment List */}
              {commentsLoading ? (
                <View style={styles.commentEmptyWrap}>
                  <ActivityIndicator color={colors.gold} />
                </View>
              ) : comments.length === 0 ? (
                <View style={styles.commentEmptyWrap}>
                  <Icon name="message-circle" size={32} color={colors.textMuted} />
                  <Text style={[styles.commentEmptyText, { color: colors.textMuted }]}>No comments yet. Be the first!</Text>
                </View>
              ) : (
                <FlatList
                  data={comments}
                  keyExtractor={(c) => c.id}
                  style={{ maxHeight: 300 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.commentItem}>
                      <View style={[styles.commentAvatar, { backgroundColor: colors.goldLight + "30" }]}>
                        <Text style={[styles.commentAvatarText, { color: colors.goldLight }]}>
                          {item.displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={[styles.commentName, { color: colors.textPrimary }]}>{item.displayName}</Text>
                          <Text style={[styles.commentTime, { color: colors.textMuted }]}>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <Text style={[styles.commentBody, { color: colors.textSecondary }]}>{item.body}</Text>
                      </View>
                      {item.isOwn && (
                        <Pressable onPress={() => handleDeleteComment(item.id)} style={{ padding: 4 }}>
                          <Icon name="trash-2" size={14} color={colors.textMuted} />
                        </Pressable>
                      )}
                    </View>
                  )}
                />
              )}

              {/* Input */}
              <View style={[styles.commentInputRow, { borderTopColor: colors.border }]}>
                <TextInput
                  style={[styles.commentInput, { backgroundColor: colors.surfaceHigh, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder={user?.id ? "Write a comment..." : "Sign in to comment"}
                  placeholderTextColor={colors.textMuted}
                  value={commentText}
                  onChangeText={setCommentText}
                  maxLength={500}
                  editable={!!user?.id}
                  multiline
                  returnKeyType="send"
                  onSubmitEditing={handleAddComment}
                />
                <Pressable
                  onPress={handleAddComment}
                  disabled={sendingComment || !commentText.trim()}
                  style={[styles.commentSendBtn, { backgroundColor: commentText.trim() ? colors.gold : colors.surfaceHigh }]}
                >
                  {sendingComment
                    ? <ActivityIndicator size="small" color={colors.surface} />
                    : <Icon name="send" size={16} color={commentText.trim() ? colors.surface : colors.textMuted} />
                  }
                </Pressable>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Translation Language Picker Modal */}
      <Modal visible={langModal} transparent animationType="slide" onRequestClose={() => setLangModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setLangModal(false)}>
          <View
            style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: "75%" }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Translation Language</Text>
              <Pressable onPress={() => setLangModal(false)}>
                <Icon name="x" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            {loadingEditions ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator color={colors.gold} />
                <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 13 }}>Loading translations...</Text>
              </View>
            ) : (
              <FlatList
                data={editions}
                keyExtractor={(e) => e.identifier}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = item.identifier === translationEdition;
                  const langName = resolveLangName(item.language);
                  return (
                    <Pressable
                      onPress={() => selectEdition(item.identifier, item.language)}
                      style={[
                        styles.speedOption,
                        isSelected && { backgroundColor: colors.gold + "15" },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.speedOptionText, { color: isSelected ? colors.goldLight : colors.textPrimary }]}>
                          {langName} — {item.englishName}
                        </Text>
                      </View>
                      {isSelected && <Icon name="check" size={16} color={colors.goldLight} />}
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  appBarCenter: { flex: 1, alignItems: "center" },
  seriesLabel: { fontSize: 14, fontWeight: "600" },
  coverWrap: { alignItems: "center", paddingVertical: 32 },
  cover: {
    width: SCREEN_W - 80,
    height: SCREEN_W - 80,
    maxWidth: 320,
    maxHeight: 320,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coverDecorCircle1: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 50,
    top: -80,
    right: -80,
    opacity: 0.5,
  },
  coverDecorCircle2: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 35,
    bottom: -40,
    left: -40,
    opacity: 0.4,
  },
  coverGrad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  coverArabic: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 28,
    marginTop: 8,
    fontFamily: "System",
  },
  coverCenterRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.18)",
    opacity: 0.8,
  },
  coverBismillah: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 22,
    marginBottom: 10,
    letterSpacing: 1,
  },
  coverArabicLarge: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 44,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  coverDivider: {
    width: 60,
    height: 1.5,
    backgroundColor: "rgba(255,215,0,0.5)",
    borderRadius: 1,
    marginVertical: 12,
  },
  coverSurahEn: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    letterSpacing: 0.5,
    fontWeight: "500",
  },
  titleWrap: { paddingHorizontal: 24, gap: 4, alignItems: "center" },
  episodeTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  episodeMeta: { fontSize: 13, textAlign: "center" },
  actionsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 16 },
  actionBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  actionBtnWithCount: { alignItems: "center", justifyContent: "center", paddingHorizontal: 6, minWidth: 44 },
  actionBtnCount: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  commentSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 12,
    maxHeight: "80%",
  },
  commentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  commentEmptyWrap: { alignItems: "center", paddingVertical: 32, gap: 12 },
  commentEmptyText: { fontSize: 14 },
  commentItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "rgba(128,128,128,0.15)" },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  commentAvatarText: { fontSize: 15, fontWeight: "700" },
  commentName: { fontSize: 13, fontWeight: "700" },
  commentTime: { fontSize: 11 },
  commentBody: { fontSize: 14, lineHeight: 20 },
  commentInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingTop: 12, borderTopWidth: 0.5 },
  commentInput: { flex: 1, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 80 },
  commentSendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  progressSection: { paddingHorizontal: 24, gap: 8 },
  progressBarBg: { height: 4, borderRadius: 2, position: "relative" },
  progressBarFill: { height: 4, borderRadius: 2 },
  progressKnob: {
    position: "absolute",
    top: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
  },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeText: { fontSize: 12 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20 },
  ctrlBtn: { width: 52, height: 52, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 0, position: "relative" },
  skipBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 2,
    borderWidth: 1,
  },
  skipNum: { fontSize: 13, fontWeight: "800", letterSpacing: -0.5 },
  playBtn: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginHorizontal: 8 },
  speedRow: { flexDirection: "row", justifyContent: "center", gap: 12, paddingBottom: 16 },
  speedPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  speedText: { fontSize: 13, fontWeight: "600" },
  nextEpisodesSection: { paddingHorizontal: 16, gap: 12 },
  nextEpisodesTitle: { fontSize: 17, fontWeight: "700", paddingTop: 4 },
  noNext: { paddingVertical: 20, alignItems: "center" },
  noNextText: { fontSize: 13 },
  nextEpCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  nextEpCover: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  nextEpInfo: { flex: 1, gap: 3 },
  nextEpTitle: { fontSize: 14, fontWeight: "600" },
  nextEpMeta: { fontSize: 11 },
  proTag: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  proTagText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  surahSection: { paddingHorizontal: 16, gap: 0 },
  surahHeaderCard: {
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 12,
    borderBottomWidth: 0.5,
    gap: 6,
  },
  surahCardArabic: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
  },
  surahCardEnglish: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  surahCardMeta: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  translationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 6,
  },
  translationBtnText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  ayahsLoading: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 24, justifyContent: "center" },
  ayahsLoadingText: { fontSize: 14 },
  ayahCard: { paddingVertical: 16, borderBottomWidth: 0.5, gap: 10 },
  ayahNumRow: { flexDirection: "row", alignItems: "center" },
  ayahNumBadge: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ayahNum: { fontSize: 11, fontWeight: "700" },
  ayahArabic: { fontSize: 22, textAlign: "right", lineHeight: 38, fontFamily: "System" },
  ayahTranslation: { fontSize: 14, lineHeight: 22 },
  activeDot: { marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, gap: 4 },
  modalTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
  speedOption: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10 },
  speedOptionText: { fontSize: 16 },
});
