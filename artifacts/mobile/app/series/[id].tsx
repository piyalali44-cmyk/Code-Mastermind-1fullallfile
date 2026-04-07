import FadeImage from "@/components/FadeImage";
import { Icon } from "@/components/Icon";
import { Toast } from "@/components/Toast";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppSettings } from "@/context/AppSettingsContext";
import { useAudio } from "@/context/AudioContext";
import { useAuth } from "@/context/AuthContext";
import { useContent } from "@/context/ContentContext";
import { useUserActions } from "@/context/UserActionsContext";
import { useColors } from "@/hooks/useColors";
import {
  toggleContentLike,
  getContentLikeStatus,
  getContentLikeCount,
  getContentComments,
  getContentCommentCount,
  addContentComment,
  softDeleteContentComment,
  isUserCommentBlocked,
  type ContentComment,
} from "@/lib/db";
import ReportModal from "@/components/ReportModal";

function AnimatedIconBtn({ onPress, children, style, containerStyle }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, tension: 250, friction: 10 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 12 }).start()}
      onPress={onPress}
      style={containerStyle}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export default function SeriesDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { play, nowPlaying } = useAudio();
  const { user, isGuest, session } = useAuth();
  const token = session?.access_token;
  const { settings } = useAppSettings();

  const { isBookmarked: isItemBookmarked, toggleBookmark, startDownload, removeDownloadedFile, isDownloaded: isEpisodeDownloaded, downloadProgress } = useUserActions();

  const { getSeriesById, loading: contentLoading } = useContent();
  const series = getSeriesById(id!);
  const hasMiniplayer = !!nowPlaying;

  if (!series) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
          {contentLoading ? "Loading..." : "Series not found"}
        </Text>
      </View>
    );
  }

  const isBookmarked = isItemBookmarked(`series:${series.id}`);

  const [moreModal, setMoreModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; icon: any; iconColor?: string }>({ visible: false, message: "", icon: "check" });
  const bookmarkScale = useRef(new Animated.Value(1)).current;
  const playBtnScale = useRef(new Animated.Value(1)).current;

  // ─── DB-backed Like ────────────────────────────────────────────────────────
  const [isDbLiked, setIsDbLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likePending, setLikePending] = useState(false);

  // ─── Comments ──────────────────────────────────────────────────────────────
  const [commentModal, setCommentModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [isCommentBlocked, setIsCommentBlocked] = useState(false);

  const CONTENT_TYPE = "series" as const;
  const CONTENT_ID = series.id;

  const showToast = (message: string, icon: any, iconColor?: string) => {
    setToast({ visible: true, message, icon, iconColor });
  };

  // Load DB like + comment counts on mount
  useEffect(() => {
    if (!series.id) return;
    getContentLikeCount(CONTENT_TYPE, CONTENT_ID).then(setLikeCount);
    getContentCommentCount(CONTENT_TYPE, CONTENT_ID).then(setCommentCount);
    if (user?.id) {
      getContentLikeStatus(user.id, CONTENT_TYPE, CONTENT_ID, token).then(r => setIsDbLiked(r.isLiked));
    }
  }, [series.id, user?.id]);

  // ─── Real-time polling for likes & comments count (every 20s) ─────────────
  useEffect(() => {
    if (!CONTENT_ID) return;
    const poll = async () => {
      const [count, likeStatus, cCount] = await Promise.all([
        getContentLikeCount(CONTENT_TYPE, CONTENT_ID),
        user?.id ? getContentLikeStatus(user.id, CONTENT_TYPE, CONTENT_ID, token) : Promise.resolve({ isLiked: false, count: 0 }),
        getContentCommentCount(CONTENT_TYPE, CONTENT_ID),
      ]);
      setLikeCount(count);
      setIsDbLiked(likeStatus.isLiked);
      setCommentCount(cCount);
    };
    const id = setInterval(poll, 20_000);
    return () => clearInterval(id);
  }, [series.id, user?.id, token]);

  // ─── Real-time polling for comments list when modal is open (every 8s) ─────
  useEffect(() => {
    if (!commentModal || !CONTENT_ID) return;
    const poll = async () => {
      const { comments: list, count } = await getContentComments(CONTENT_TYPE, CONTENT_ID, user?.id, token);
      setComments(list);
      setCommentCount(count);
    };
    const id = setInterval(poll, 8_000);
    return () => clearInterval(id);
  }, [commentModal, series.id, user?.id, token]);

  // ─── DB Like ───────────────────────────────────────────────────────────────
  const handleDbLike = async () => {
    if (!user?.id) {
      showToast("Sign in to like", "heart", colors.textSecondary);
      return;
    }
    if (likePending) return;
    setLikePending(true);
    const optimistic = !isDbLiked;
    setIsDbLiked(optimistic);
    setLikeCount(c => optimistic ? c + 1 : Math.max(0, c - 1));
    const result = await toggleContentLike(user.id, CONTENT_TYPE, CONTENT_ID, token);
    setIsDbLiked(result.liked);
    setLikeCount(await getContentLikeCount(CONTENT_TYPE, CONTENT_ID));
    setLikePending(false);
  };

  // ─── Bookmark ──────────────────────────────────────────────────────────────
  const handleToggleBookmark = () => {
    if (isGuest) {
      showToast("Sign in to bookmark series", "user", colors.textSecondary);
      setTimeout(() => router.push("/login"), 600);
      return;
    }
    const added = toggleBookmark(`series:${series.id}`, { title: series.title, coverColor: series.coverColor });
    showToast(added ? "Saved to Library" : "Removed from Library", "bookmark", added ? colors.gold : colors.textSecondary);
    Animated.sequence([
      Animated.spring(bookmarkScale, { toValue: 1.3, useNativeDriver: true, tension: 300 }),
      Animated.spring(bookmarkScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
  };

  // ─── Comments ──────────────────────────────────────────────────────────────
  const handleOpenComments = async () => {
    setCommentModal(true);
    setCommentsLoading(true);
    const [{ comments: list }, blocked] = await Promise.all([
      getContentComments(CONTENT_TYPE, CONTENT_ID, user?.id, token),
      user?.id ? isUserCommentBlocked(user.id, token) : Promise.resolve(false),
    ]);
    setComments(list);
    setIsCommentBlocked(blocked);
    setCommentsLoading(false);
  };

  const handleAddComment = async () => {
    if (!user?.id) { showToast("Sign in to comment", "message-circle", colors.textSecondary); return; }
    const text = commentText.trim();
    if (!text) return;
    setSendingComment(true);
    const result = await addContentComment(user.id, CONTENT_TYPE, CONTENT_ID, text, token, user?.displayName ?? undefined);
    if (result) {
      setCommentText("");
      const { comments: list } = await getContentComments(CONTENT_TYPE, CONTENT_ID, user.id, token);
      setComments(list);
      setCommentCount(await getContentCommentCount(CONTENT_TYPE, CONTENT_ID));
    } else {
      showToast("Failed to send comment", "alert-circle", colors.error);
    }
    setSendingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const ok = await softDeleteContentComment(commentId, token);
    if (ok) {
      setComments(prev => prev.filter(c => c.id !== commentId));
      setCommentCount(c => Math.max(0, c - 1));
    }
  };

  const handlePlayEpisode = async (episodeId: string) => {
    const ep = series.episodes.find((e) => e.id === episodeId);
    if (!ep) return;
    if (settings.subscription_enabled && ep.isPremium && !user?.isPremium) {
      router.push("/subscription");
      return;
    }
    if (!ep.hasAudio) {
      showToast("Audio coming soon, inshallah! 🌙", "clock", colors.textSecondary);
      return;
    }
    Animated.sequence([
      Animated.spring(playBtnScale, { toValue: 0.93, useNativeDriver: true, tension: 250 }),
      Animated.spring(playBtnScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
    router.push("/player");
    await play({
      id: ep.id,
      title: ep.title,
      seriesName: series.title,
      episodeNum: `Episode ${ep.number} of ${series.episodeCount}`,
      coverColor: series.coverColor,
      coverUrl: ep.coverUrl || series.coverUrl,
      audioUrl: ep.audioUrl,
      type: "story",
      seriesId: series.id,
      episodeIndex: ep.number - 1,
    }, user?.id);
  };

  const freeCount = series.episodes.filter((e) => !e.isPremium).length;
  const completedCount = series.episodes.filter((e) => e.progress === 100).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Sticky back + more buttons — always visible */}
      <AnimatedIconBtn
        onPress={() => router.back()}
        containerStyle={[styles.navBtnAbsolute, { top: insets.top + (Platform.OS === "web" ? 67 : 0) + 10, left: 16 }]}
        style={styles.navBtn}
      >
        {Platform.OS === "ios" ? (
          <BlurView intensity={40} tint="dark" style={styles.navBtnInner}>
            <Icon name="chevron-left" size={22} color="#fff" />
          </BlurView>
        ) : (
          <View style={[styles.navBtnInner, { backgroundColor: "rgba(8,15,28,0.75)" }]}>
            <Icon name="chevron-left" size={22} color="#fff" />
          </View>
        )}
      </AnimatedIconBtn>
      <AnimatedIconBtn
        onPress={() => setMoreModal(true)}
        containerStyle={[styles.navBtnAbsolute, { top: insets.top + (Platform.OS === "web" ? 67 : 0) + 10, right: 16 }]}
        style={styles.navBtn}
      >
        {Platform.OS === "ios" ? (
          <BlurView intensity={40} tint="dark" style={styles.navBtnInner}>
            <Icon name="more-horizontal" size={20} color="#fff" />
          </BlurView>
        ) : (
          <View style={[styles.navBtnInner, { backgroundColor: "rgba(8,15,28,0.75)" }]}>
            <Icon name="more-horizontal" size={20} color="#fff" />
          </View>
        )}
      </AnimatedIconBtn>

      {/* Main FlatList — hero scrolls away, Episodes header stays sticky */}
      <FlatList
        data={[{ _type: "header" as const, id: "__ep_header__" }, ...series.episodes.map(ep => ({ _type: "episode" as const, ...ep }))]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <>
            {/* Hero — YT Music / Pocket FM style */}
            <View style={[styles.hero, { backgroundColor: series.coverColor, paddingTop: insets.top }]}>
              {series.coverUrl ? (
                <>
                  <FadeImage
                    uri={series.coverUrl}
                    style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.2 }] }]}
                  />
                  <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                </>
              ) : (
                <>
                  <View style={styles.heroCircle1} />
                  <View style={styles.heroCircle2} />
                  <View style={styles.heroCircle3} />
                </>
              )}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.38)" }]} />
              <View style={styles.heroArtworkWrap}>
                {series.coverUrl ? (
                  <View style={styles.artworkCard}>
                    <FadeImage uri={series.coverUrl} style={styles.artworkImage} />
                  </View>
                ) : (
                  <View style={[styles.artworkCard, styles.artworkCardFallback, { backgroundColor: series.coverColor }]}>
                    <Icon name="headphones" size={56} color="rgba(255,255,255,0.9)" />
                  </View>
                )}
              </View>
              <LinearGradient
                colors={["transparent", colors.background]}
                style={styles.heroGrad}
              />
            </View>

            <View style={styles.content}>
              {/* Category + language badges */}
              <View style={styles.badgeRow}>
                <View style={[styles.catBadge, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "44" }]}>
                  <Icon name="tag" size={10} color={colors.goldLight} />
                  <Text style={[styles.catBadgeText, { color: colors.goldLight }]}>{series.category}</Text>
                </View>
                <View style={[styles.catBadge, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                  <Icon name="globe" size={10} color={colors.textSecondary} />
                  <Text style={[styles.catBadgeText, { color: colors.textSecondary }]}>English</Text>
                </View>
                {series.isNew && (
                  <View style={[styles.catBadge, { backgroundColor: colors.green + "22", borderColor: colors.green + "44" }]}>
                    <Text style={[styles.catBadgeText, { color: colors.green }]}>NEW</Text>
                  </View>
                )}
              </View>

              {/* Title */}
              <Text style={[styles.seriesTitle, { color: colors.textPrimary }]}>{series.title}</Text>

              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Icon name="headphones" size={14} color={colors.gold} />
                  <Text style={[styles.statText, { color: colors.textSecondary }]}>{series.episodeCount} episodes</Text>
                </View>
                <View style={[styles.statDot, { backgroundColor: colors.divider }]} />
                <View style={styles.statItem}>
                  <Icon name="clock" size={14} color={colors.gold} />
                  <Text style={[styles.statText, { color: colors.textSecondary }]}>{series.totalHours}</Text>
                </View>
                <View style={[styles.statDot, { backgroundColor: colors.divider }]} />
                <View style={styles.statItem}>
                  <Icon name="unlock" size={14} color={colors.green} />
                  <Text style={[styles.statText, { color: colors.textSecondary }]}>
                    {settings.subscription_enabled ? `${freeCount} free` : "All free"}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <Text style={[styles.seriesDesc, { color: colors.textSecondary }]}>{series.description}</Text>

              {/* Progress bar if started */}
              {completedCount > 0 && (
                <View style={styles.progressSection}>
                  <View style={styles.progressLabelRow}>
                    <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Your progress</Text>
                    <Text style={[styles.progressPct, { color: colors.goldLight }]}>
                      {completedCount}/{series.episodes.length} episodes
                    </Text>
                  </View>
                  <View style={[styles.progressBg, { backgroundColor: colors.divider }]}>
                    <View style={[styles.progressFill, {
                      width: `${(completedCount / series.episodes.length) * 100}%`,
                      backgroundColor: colors.gold,
                    }]} />
                  </View>
                </View>
              )}

              {/* Action buttons */}
              <View style={styles.btnRow}>
                <Pressable
                  onPressIn={() => Animated.spring(playBtnScale, { toValue: 0.95, useNativeDriver: true, tension: 250 }).start()}
                  onPressOut={() => Animated.spring(playBtnScale, { toValue: 1, useNativeDriver: true, tension: 200 }).start()}
                  onPress={() => series.episodes.length > 0 && handlePlayEpisode(series.episodes[0].id)}
                  style={{ flex: 1 }}
                >
                  <Animated.View style={[styles.playBtn, { backgroundColor: colors.gold, transform: [{ scale: playBtnScale }] }]}>
                    <Icon name="play" size={18} color="#fff" />
                    <Text style={styles.playBtnText}>Play Now</Text>
                  </Animated.View>
                </Pressable>

                <AnimatedIconBtn
                  onPress={handleDbLike}
                  style={[styles.iconBtnWithCount, {
                    backgroundColor: isDbLiked ? colors.gold + "22" : colors.surfaceHigh,
                    borderColor: isDbLiked ? colors.gold : colors.border,
                  }]}
                >
                  <Icon name="heart" size={19} color={isDbLiked ? colors.gold : colors.textPrimary} />
                  <Text style={[styles.iconBtnCount, { color: isDbLiked ? colors.gold : colors.textMuted }]}>
                    {likeCount > 999 ? `${Math.floor(likeCount / 1000)}k` : likeCount}
                  </Text>
                </AnimatedIconBtn>

                <AnimatedIconBtn
                  onPress={handleOpenComments}
                  style={[styles.iconBtnWithCount, {
                    backgroundColor: colors.surfaceHigh,
                    borderColor: colors.border,
                  }]}
                >
                  <Icon name="message-circle" size={19} color={colors.textPrimary} />
                  <Text style={[styles.iconBtnCount, { color: colors.textMuted }]}>
                    {commentCount > 999 ? `${Math.floor(commentCount / 1000)}k` : commentCount}
                  </Text>
                </AnimatedIconBtn>

                <AnimatedIconBtn
                  onPress={handleToggleBookmark}
                  style={[styles.iconBtn, {
                    backgroundColor: isBookmarked ? colors.gold + "22" : colors.surfaceHigh,
                    borderColor: isBookmarked ? colors.gold : colors.border,
                  }]}
                >
                  <Animated.View style={{ transform: [{ scale: bookmarkScale }] }}>
                    <Icon name="bookmark" size={19} color={isBookmarked ? colors.gold : colors.textPrimary} />
                  </Animated.View>
                </AnimatedIconBtn>
              </View>
            </View>

          </>
        }
        renderItem={({ item }) => {
          if (item._type === "header") {
            return (
              <View style={[styles.epHeader, {
                backgroundColor: colors.background,
                borderBottomColor: colors.divider,
                marginTop: 0,
                paddingHorizontal: 20,
                paddingTop: 14,
              }]}>
                <Text style={[styles.episodesLabel, { color: colors.textPrimary }]}>
                  Episodes
                  <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: "400" }}> · {series.episodeCount}</Text>
                </Text>
              </View>
            );
          }
          const ep = item;
          const isLocked = settings.subscription_enabled && ep.isPremium && !user?.isPremium;
          const isPlaying = nowPlaying?.id === ep.id;
          const noAudio = !ep.hasAudio;
          return (
            <Pressable
              onPress={() => isLocked ? router.push("/subscription") : handlePlayEpisode(ep.id)}
              style={({ pressed }) => [
                styles.episodeRow,
                {
                  borderBottomColor: colors.divider,
                  backgroundColor: pressed ? colors.surfaceHigh : "transparent",
                  opacity: isLocked ? 0.7 : 1,
                },
              ]}
            >
              <View style={[styles.epNumWrap, { backgroundColor: isPlaying ? colors.gold + "22" : colors.surfaceHigh }]}>
                {isLocked ? (
                  <Icon name="lock" size={14} color={colors.gold} />
                ) : isPlaying ? (
                  <Icon name="volume-2" size={14} color={colors.gold} />
                ) : (
                  <Text style={[styles.epNum, { color: colors.textMuted }]}>{ep.number}</Text>
                )}
              </View>

              <View style={styles.epInfo}>
                <View style={styles.epTitleRow}>
                  <Text
                    style={[styles.epTitle, { color: isPlaying ? colors.goldLight : colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {ep.title}
                  </Text>
                  {settings.subscription_enabled && ep.isPremium && (
                    <View style={[styles.premBadge, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "44" }]}>
                      <Icon name="star" size={8} color={colors.goldLight} />
                      <Text style={[styles.premBadgeText, { color: colors.goldLight }]}>PRO</Text>
                    </View>
                  )}
                  {noAudio && !isLocked && (
                    <View style={[styles.premBadge, { backgroundColor: colors.textMuted + "18", borderColor: colors.textMuted + "33" }]}>
                      <Icon name="clock" size={8} color={colors.textMuted} />
                      <Text style={[styles.premBadgeText, { color: colors.textMuted }]}>SOON</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.epDesc, { color: colors.textSecondary }]} numberOfLines={1}>{ep.description}</Text>
                <View style={styles.epBottom}>
                  <Icon name="clock" size={10} color={colors.textMuted} />
                  <Text style={[styles.epDuration, { color: colors.textMuted }]}>{ep.duration}</Text>
                  {ep.progress > 0 && ep.progress < 100 && (
                    <>
                      <View style={[styles.epProgBg, { backgroundColor: colors.divider }]}>
                        <View style={[styles.epProgFill, { width: `${ep.progress}%`, backgroundColor: colors.gold }]} />
                      </View>
                      <Text style={[styles.epDuration, { color: colors.gold }]}>{ep.progress}%</Text>
                    </>
                  )}
                  {ep.progress === 100 && (
                    <View style={styles.completedBadge}>
                      <Icon name="check-circle" size={12} color={colors.green} />
                      <Text style={[styles.completedText, { color: colors.green }]}>Done</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Right actions */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {!isLocked && ep.hasAudio && (() => {
                  const dlKey = `episode:${ep.id}`;
                  const dlProgress = downloadProgress.get(dlKey);
                  const downloaded = isEpisodeDownloaded(dlKey);
                  if (dlProgress !== undefined && dlProgress < 1) {
                    return (
                      <View style={[styles.epDownloadWrap, { borderColor: colors.gold + "44", backgroundColor: colors.gold + "11" }]}>
                        <Text style={{ color: colors.gold, fontSize: 9, fontWeight: "700" }}>
                          {Math.round(dlProgress * 100)}%
                        </Text>
                      </View>
                    );
                  }
                  return (
                    <Pressable
                      onPress={() => {
                        if (downloaded) {
                          removeDownloadedFile(dlKey);
                        } else if (isGuest) {
                          showToast("Sign in to download episodes", "user", colors.textSecondary);
                          setTimeout(() => router.push("/login"), 600);
                        } else {
                          startDownload(dlKey, ep.audioUrl, { title: ep.title });
                          router.push("/(tabs)/library?tab=downloads");
                        }
                      }}
                      style={[styles.epDownloadWrap, {
                        borderColor: downloaded ? colors.green + "55" : colors.border,
                        backgroundColor: downloaded ? colors.green + "11" : "transparent",
                      }]}
                      hitSlop={8}
                    >
                      <Icon
                        name={downloaded ? "check-circle" : "download"}
                        size={13}
                        color={downloaded ? colors.green : colors.textMuted}
                      />
                    </Pressable>
                  );
                })()}
                {!isLocked && (
                  <View style={[styles.epPlayWrap, {
                    backgroundColor: isPlaying ? colors.gold : colors.surfaceHigh,
                    opacity: noAudio ? 0.4 : 1,
                  }]}>
                    <Icon name={isPlaying ? "pause" : noAudio ? "clock" : "play"} size={14} color={isPlaying ? "#fff" : noAudio ? colors.textMuted : colors.gold} />
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={series.episodes.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
            <Icon name="headphones" size={28} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>No published episodes yet</Text>
          </View>
        ) : null}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        icon={toast.icon}
        iconColor={toast.iconColor}
        onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
      />

      {/* Comment Modal */}
      <Modal visible={commentModal} transparent animationType="slide" onRequestClose={() => setCommentModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setCommentModal(false)} />
            <View style={[cmtStyles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[cmtStyles.handle, { backgroundColor: colors.border }]} />
              <Text style={[cmtStyles.title, { color: colors.textPrimary }]}>
                Comments{commentCount > 0 ? ` (${commentCount})` : ""}
              </Text>

              {commentsLoading ? (
                <ActivityIndicator color={colors.gold} style={{ marginVertical: 32 }} />
              ) : (
                <FlatList
                  data={comments}
                  keyExtractor={c => c.id}
                  style={{ maxHeight: 340 }}
                  contentContainerStyle={{ gap: 2 }}
                  ListEmptyComponent={
                    <Text style={[cmtStyles.empty, { color: colors.textMuted }]}>
                      No comments yet. Be the first!
                    </Text>
                  }
                  renderItem={({ item: c }) => (
                    <View style={[cmtStyles.commentRow, { borderBottomColor: colors.divider }]}>
                      <View style={[cmtStyles.avatar, { backgroundColor: colors.gold + "33" }]}>
                        <Text style={[cmtStyles.avatarText, { color: colors.gold }]}>
                          {(c.displayName || "U").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={[cmtStyles.name, { color: colors.textPrimary }]}>{c.displayName || "User"}</Text>
                          {c.isOwn && (
                            <Pressable onPress={() => handleDeleteComment(c.id)} hitSlop={8}>
                              <Icon name="trash-2" size={13} color={colors.textMuted} />
                            </Pressable>
                          )}
                        </View>
                        <Text style={[cmtStyles.body, { color: colors.textSecondary }]}>{c.body}</Text>
                      </View>
                    </View>
                  )}
                />
              )}

              {isCommentBlocked ? (
                <View style={[cmtStyles.blockedBanner, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                  <Icon name="slash" size={15} color={colors.textMuted} />
                  <Text style={[cmtStyles.blockedText, { color: colors.textMuted }]}>You have been restricted from commenting.</Text>
                </View>
              ) : (
                <View style={[cmtStyles.inputRow, { borderTopColor: colors.border }]}>
                  <TextInput
                    style={[cmtStyles.input, { backgroundColor: colors.surfaceHigh, color: colors.textPrimary, borderColor: colors.border }]}
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
                    style={[cmtStyles.sendBtn, { backgroundColor: commentText.trim() ? colors.gold : colors.surfaceHigh }]}
                  >
                    {sendingComment
                      ? <ActivityIndicator size="small" color={colors.surface} />
                      : <Icon name="send" size={15} color={commentText.trim() ? colors.surface : colors.textMuted} />
                    }
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* More Options Modal */}
      <Modal visible={moreModal} transparent animationType="slide" onRequestClose={() => setMoreModal(false)}>
        <Pressable style={moreStyles.overlay} onPress={() => setMoreModal(false)}>
          <View style={[moreStyles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <View style={[moreStyles.handle, { backgroundColor: colors.border }]} />
            <Text style={[moreStyles.sheetTitle, { color: colors.textPrimary }]}>{series.title}</Text>
            <Pressable onPress={() => { setMoreModal(false); handleDbLike(); }} style={moreStyles.row}>
              <Icon name="thumbs-up" size={18} color={isDbLiked ? colors.gold : colors.textSecondary} />
              <Text style={[moreStyles.rowLabel, { color: colors.textPrimary }]}>{isDbLiked ? "Unlike" : "Like"}</Text>
            </Pressable>
            <Pressable onPress={() => { setMoreModal(false); handleOpenComments(); }} style={moreStyles.row}>
              <Icon name="message-circle" size={18} color={colors.textSecondary} />
              <Text style={[moreStyles.rowLabel, { color: colors.textPrimary }]}>Comments{commentCount > 0 ? ` (${commentCount})` : ""}</Text>
            </Pressable>
            <Pressable onPress={() => { handleToggleBookmark(); setMoreModal(false); }} style={moreStyles.row}>
              <Icon name="bookmark" size={18} color={isBookmarked ? colors.gold : colors.textSecondary} />
              <Text style={[moreStyles.rowLabel, { color: colors.textPrimary }]}>{isBookmarked ? "Remove from Library" : "Save to Library"}</Text>
            </Pressable>
            <Pressable onPress={() => { setMoreModal(false); setReportModal(true); }} style={moreStyles.row}>
              <Icon name="flag" size={18} color="#f87171" />
              <Text style={[moreStyles.rowLabel, { color: "#f87171" }]}>Report an Issue</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <ReportModal
        visible={reportModal}
        onClose={() => setReportModal(false)}
        contentId={series.id}
        contentType="series"
        contentTitle={series.title}
      />
    </View>
  );
}

const moreStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 20, paddingBottom: 36, gap: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.06)" },
  rowLabel: { fontSize: 15 },
});

const cmtStyles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, padding: 20, paddingBottom: 36, gap: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  title: { fontSize: 16, fontWeight: "700" },
  empty: { textAlign: "center", paddingVertical: 24, fontSize: 14 },
  commentRow: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700" },
  name: { fontSize: 13, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingTop: 12, borderTopWidth: 0.5 },
  input: { flex: 1, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 80 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  blockedBanner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 4 },
  blockedText: { fontSize: 13, flex: 1 },
});

const styles = StyleSheet.create({
  hero: {
    height: 390,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  heroCircle1: {
    position: "absolute",
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: "rgba(255,255,255,0.04)",
    top: -100,
    right: -80,
  },
  heroCircle2: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.03)",
    bottom: -60,
    left: -50,
  },
  heroCircle3: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(0,0,0,0.15)",
    top: 20,
    left: -40,
  },
  heroArtworkWrap: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  artworkCard: {
    width: 168,
    height: 168,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  artworkImage: {
    width: "100%",
    height: "100%",
  },
  artworkCardFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroGrad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  navBtnAbsolute: {
    position: "absolute",
    zIndex: 10,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 0.6,
    borderColor: "rgba(255,255,255,0.18)",
  },
  navBtnInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 20,
    gap: 12,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  seriesTitle: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 31,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statText: {
    fontSize: 13,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  seriesDesc: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 2,
  },
  progressSection: {
    gap: 8,
    marginTop: 4,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: 12,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: "600",
  },
  progressBg: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 8,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
  },
  playBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  iconBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnWithCount: {
    minWidth: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    gap: 3,
  },
  iconBtnCount: {
    fontSize: 11,
    fontWeight: "700",
  },
  epHeader: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginTop: 8,
  },
  episodesLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  episodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderRadius: 10,
  },
  epNumWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  epNum: {
    fontSize: 13,
    fontWeight: "600",
  },
  epInfo: {
    flex: 1,
    gap: 4,
  },
  epTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  epTitle: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  premBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  premBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  epDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  epBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  epDuration: {
    fontSize: 11,
  },
  epProgBg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    marginLeft: 4,
    overflow: "hidden",
  },
  epProgFill: {
    height: 3,
    borderRadius: 2,
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 4,
  },
  completedText: {
    fontSize: 11,
    fontWeight: "600",
  },
  epPlayWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  epDownloadWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
