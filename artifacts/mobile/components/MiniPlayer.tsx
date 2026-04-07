import { Icon } from "@/components/Icon";
import FadeImage from "@/components/FadeImage";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";

export function MiniPlayer() {
  const colors = useColors();
  const router = useRouter();
  const { nowPlaying, isPlaying, pause, resume, position, duration } = useAudio();

  if (!nowPlaying) return null;

  const progress = duration > 0 ? position / duration : 0;

  // Primary accent: theme's own gold (changes with dark/light mode)
  const accent = colors.goldLight;
  // Subtle series-specific tint in the background (low opacity)
  const coverTint = nowPlaying.coverColor ? nowPlaying.coverColor + "18" : accent + "18";

  const handlePlayPause = async () => {
    if (isPlaying) await pause();
    else await resume();
  };

  return (
    <Pressable
      onPress={() => router.push("/player")}
      style={[styles.container, { backgroundColor: colors.surfaceHigh, borderTopColor: accent + "55" }]}
    >
      {/* Subtle tint overlay using series color */}
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: coverTint, pointerEvents: "none" }]}
      />

      {/* Progress bar — uses theme gold */}
      <View style={[styles.progressBar, { backgroundColor: colors.divider }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
      </View>

      <View style={styles.row}>
        {/* Cover art */}
        <View style={[styles.cover, { backgroundColor: nowPlaying.coverColor || accent }]}>
          {nowPlaying.coverUrl ? (
            <FadeImage
              uri={nowPlaying.coverUrl}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <Icon
              name={nowPlaying.type === "quran" ? "book-open" : "headphones"}
              size={18}
              color="#fff"
            />
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {nowPlaying.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {nowPlaying.seriesName}
          </Text>
        </View>

        {/* Play/Pause button — uses theme gold, changes with mode */}
        <Pressable
          onPress={handlePlayPause}
          style={[styles.playBtn, { backgroundColor: accent }]}
          hitSlop={8}
        >
          <Icon name={isPlaying ? "pause" : "play"} size={18} color="#fff" />
        </Pressable>

        <Pressable style={styles.btn} hitSlop={8}>
          <Icon name="skip-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    overflow: "hidden",
  },
  progressBar: {
    height: 2.5,
  },
  progressFill: {
    height: 2.5,
    borderRadius: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 11,
  },
  cover: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  btn: {
    padding: 4,
  },
});
