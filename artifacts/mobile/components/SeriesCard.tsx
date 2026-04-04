import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Series } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

interface Props {
  series: Series;
  size?: "normal" | "large" | "small";
}

export const SeriesCard = React.memo(function SeriesCard({ series, size = "normal" }: Props) {
  const colors = useColors();
  const router = useRouter();

  const cardW = size === "large" ? 200 : size === "small" ? 140 : 160;
  const cardH = size === "large" ? 160 : size === "small" ? 110 : 130;

  return (
    <Pressable
      onPress={() => router.push(`/series/${series.id}`)}
      style={[styles.card, { width: cardW, backgroundColor: series.coverColor || colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.coverBox, { height: cardH }]}>
        <Icon name="headphones" size={size === "large" ? 32 : 24} color={colors.goldLight} style={styles.icon} />
        {series.isNew && (
          <View style={[styles.badge, { backgroundColor: colors.green }]}>
            <Text style={styles.badgeText}>NEW</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>{series.title}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>{series.episodeCount} eps · {series.totalHours}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 0.5,
  },
  coverBox: {
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    opacity: 0.7,
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  info: {
    padding: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  meta: {
    fontSize: 11,
    marginTop: 4,
  },
});
