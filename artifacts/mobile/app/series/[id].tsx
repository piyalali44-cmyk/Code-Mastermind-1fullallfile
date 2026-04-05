import FadeImage from "@/components/FadeImage";
import { Icon } from "@/components/Icon";
import { Toast } from "@/components/Toast";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";

import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAudio } from "@/context/AudioContext";
import { useAuth } from "@/context/AuthContext";
import { useContent } from "@/context/ContentContext";
import { useUserActions } from "@/context/UserActionsContext";
import { useColors } from "@/hooks/useColors";

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
  const { user } = useAuth();

  const { isFavourite, isBookmarked: isItemBookmarked, toggleFavourite, toggleBookmark, startDownload, removeDownloadedFile, isDownloaded: isEpisodeDownloaded, downloadProgress } = useUserActions();

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

  const isLiked = isFavourite(`series:${series.id}`);
  const isBookmarked = isItemBookmarked(`series:${series.id}`);

  const [moreModal, setMoreModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; icon: any; iconColor?: string }>({ visible: false, message: "", icon: "check" });
  const likeScale = useRef(new Animated.Value(1)).current;
  const bookmarkScale = useRef(new Animated.Value(1)).current;
  const playBtnScale = useRef(new Animated.Value(1)).current;

  const showToast = (message: string, icon: any, iconColor?: string) => {
    setToast({ visible: true, message, icon, iconColor });
  };

  const shareLink = `https://stayguided.me/series/${series.id}`;
  const shareMessage = `Check out "${series.title}" on StayGuided Me — an Islamic audio app!\n${shareLink}`;

  const handleToggleLike = () => {
    const added = toggleFavourite(`series:${series.id}`, { title: series.title, coverColor: series.coverColor });
    showToast(added ? "Added to Favourites" : "Removed from Favourites", "heart", added ? colors.gold : colors.textSecondary);
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.3, useNativeDriver: true, tension: 300 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
  };

  const handleToggleBookmark = () => {
    const added = toggleBookmark(`series:${series.id}`, { title: series.title, coverColor: series.coverColor });
    showToast(added ? "Saved to Library" : "Removed from Library", "bookmark", added ? colors.gold : colors.textSecondary);
    Animated.sequence([
      Animated.spring(bookmarkScale, { toValue: 1.3, useNativeDriver: true, tension: 300 }),
      Animated.spring(bookmarkScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
  };

  const handleShare = () => {
    setCopiedLink(false);
    setShareModal(true);
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(shareLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (_) {}
  };

  const handlePlayEpisode = async (episodeId: string) => {
    const ep = series.episodes.find((e) => e.id === episodeId);
    if (!ep) return;
    if (ep.isPremium && !user?.isPremium) {
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

      <ScrollView
        contentContainerStyle={{ paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — YT Music / Pocket FM style */}
        <View style={[styles.hero, { backgroundColor: series.coverColor, paddingTop: insets.top }]}>
          {/* Full blurred background */}
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

          {/* Dark overlay */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.38)" }]} />

          {/* Centered square artwork — album cover style */}
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

          {/* Gradient fade to page background */}
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
              <Text style={[styles.statText, { color: colors.textSecondary }]}>{freeCount} free</Text>
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
            {/* Play button */}
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

            {/* Like */}
            <AnimatedIconBtn
              onPress={handleToggleLike}
              style={[styles.iconBtn, {
                backgroundColor: isLiked ? colors.gold + "22" : colors.surfaceHigh,
                borderColor: isLiked ? colors.gold : colors.border,
              }]}
            >
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <Icon name="heart" size={20} color={isLiked ? colors.gold : colors.textPrimary} />
              </Animated.View>
            </AnimatedIconBtn>

            {/* Bookmark */}
            <AnimatedIconBtn
              onPress={handleToggleBookmark}
              style={[styles.iconBtn, {
                backgroundColor: isBookmarked ? colors.gold + "22" : colors.surfaceHigh,
                borderColor: isBookmarked ? colors.gold : colors.border,
              }]}
            >
              <Animated.View style={{ transform: [{ scale: bookmarkScale }] }}>
                <Icon name={isBookmarked ? "bookmark" : "bookmark"} size={20} color={isBookmarked ? colors.gold : colors.textPrimary} />
              </Animated.View>
            </AnimatedIconBtn>

            {/* Share */}
            <AnimatedIconBtn
              onPress={handleShare}
              style={[styles.iconBtn, {
                backgroundColor: colors.surfaceHigh,
                borderColor: colors.border,
              }]}
            >
              <Icon name="share-2" size={20} color={colors.textPrimary} />
            </AnimatedIconBtn>
          </View>

          {/* Episodes header */}
          <View style={[styles.epHeader, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.episodesLabel, { color: colors.textPrimary }]}>
              Episodes
              <Text style={[{ color: colors.textMuted, fontSize: 14, fontWeight: "400" }]}> · {series.episodeCount}</Text>
            </Text>
          </View>

          {/* Episode List */}
          {series.episodes.map((ep, idx) => {
            const isLocked = ep.isPremium && !user?.isPremium;
            const isPlaying = nowPlaying?.id === ep.id;
            const noAudio = !ep.hasAudio;
            return (
              <Pressable
                key={ep.id}
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
                {/* Number / icon */}
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
                    {ep.isPremium && (
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
                      backgroundColor: isPlaying ? colors.gold : noAudio ? colors.surfaceHigh : colors.surfaceHigh,
                      opacity: noAudio ? 0.4 : 1,
                    }]}>
                      <Icon name={isPlaying ? "pause" : noAudio ? "clock" : "play"} size={14} color={isPlaying ? "#fff" : noAudio ? colors.textMuted : colors.gold} />
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        icon={toast.icon}
        iconColor={toast.iconColor}
        onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
      />

      {/* Share Modal */}
      <Modal visible={shareModal} transparent animationType="slide" onRequestClose={() => setShareModal(false)}>
        <Pressable style={moreStyles.overlay} onPress={() => setShareModal(false)}>
          <View style={[moreStyles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <View style={[moreStyles.handle, { backgroundColor: colors.border }]} />
            <Text style={[moreStyles.sheetTitle, { color: colors.textPrimary }]}>Share</Text>
            <View style={[styles.sharePreview, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
              <View style={[styles.shareCover, { backgroundColor: series.coverColor }]}>
                <Icon name="headphones" size={18} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.shareTitle, { color: colors.textPrimary }]} numberOfLines={1}>{series.title}</Text>
                <Text style={[styles.shareSub, { color: colors.textSecondary }]} numberOfLines={1}>{series.episodeCount} episodes</Text>
              </View>
            </View>
            <Pressable onPress={handleCopyLink} style={moreStyles.row}>
              <Icon name={copiedLink ? "check" : "link"} size={16} color={copiedLink ? colors.green : colors.textSecondary} />
              <Text style={[moreStyles.rowLabel, { color: copiedLink ? colors.green : colors.textPrimary }]}>{copiedLink ? "Link Copied!" : "Copy Link"}</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                setShareModal(false);
                try { await Share.share({ message: shareMessage, title: series.title }); } catch (_) {}
              }}
              style={moreStyles.row}
            >
              <Icon name="share-2" size={16} color={colors.textSecondary} />
              <Text style={[moreStyles.rowLabel, { color: colors.textPrimary }]}>Share via...</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(shareMessage);
                setCopiedLink(true);
                setTimeout(() => { setCopiedLink(false); setShareModal(false); }, 1200);
              }}
              style={moreStyles.row}
            >
              <Icon name="copy" size={16} color={colors.textSecondary} />
              <Text style={[moreStyles.rowLabel, { color: colors.textPrimary }]}>Copy Message</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* More Options Modal */}
      <Modal visible={moreModal} transparent animationType="slide" onRequestClose={() => setMoreModal(false)}>
        <Pressable style={moreStyles.overlay} onPress={() => setMoreModal(false)}>
          <View style={[moreStyles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <View style={[moreStyles.handle, { backgroundColor: colors.border }]} />
            <Text style={[moreStyles.sheetTitle, { color: colors.textPrimary }]}>{series.title}</Text>
            <Pressable onPress={() => { handleToggleLike(); setMoreModal(false); }} style={moreStyles.row}>
              <Icon name="heart" size={18} color={isLiked ? colors.gold : colors.textSecondary} />
              <Text style={[moreStyles.rowLabel, { color: colors.textPrimary }]}>{isLiked ? "Remove from Favourites" : "Add to Favourites"}</Text>
            </Pressable>
            <Pressable onPress={() => { handleToggleBookmark(); setMoreModal(false); }} style={moreStyles.row}>
              <Icon name="bookmark" size={18} color={isBookmarked ? colors.gold : colors.textSecondary} />
              <Text style={[moreStyles.rowLabel, { color: colors.textPrimary }]}>{isBookmarked ? "Remove from Library" : "Save to Library"}</Text>
            </Pressable>
            <Pressable onPress={() => { setMoreModal(false); handleShare(); }} style={moreStyles.row}>
              <Icon name="share-2" size={18} color={colors.textSecondary} />
              <Text style={[moreStyles.rowLabel, { color: colors.textPrimary }]}>Share Series</Text>
            </Pressable>
            <Pressable onPress={() => {  setMoreModal(false); }} style={moreStyles.row}>
              <Icon name="flag" size={18} color={colors.textSecondary} />
              <Text style={[moreStyles.rowLabel, { color: colors.textPrimary }]}>Report an Issue</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  sharePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  shareCover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  shareSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
