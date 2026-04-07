import { Icon } from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FadeImage from "@/components/FadeImage";
import { useContent } from "@/context/ContentContext";
import { useColors } from "@/hooks/useColors";
import type { Series } from "@/data/mockData";

export default function PopularScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { series: allSeries } = useContent();
  const popular = [...allSeries]
    .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0) || (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0))
    .slice(0, 20);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (isWeb ? 67 : 0) + 8 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surfaceHigh }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Most Popular</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {popular.map((item) => (
          <PopularCard key={item.id} item={item} />
        ))}
      </ScrollView>
    </View>
  );
}

function PopularCard({ item }: { item: Series }) {
  const colors = useColors();
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 12 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 12 }).start()}
      onPress={() => router.push(`/series/${item.id}`)}
    >
      <Animated.View style={[styles.card, { backgroundColor: item.coverColor, transform: [{ scale }] }]}>
        {item.coverUrl ? (
          <FadeImage uri={item.coverUrl} style={StyleSheet.absoluteFill} />
        ) : null}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.grad}>
          <View style={[styles.catBadge, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
            <Text style={styles.catText}>{item.category}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <View style={styles.metaRow}>
            <Icon name="headphones" size={12} color="rgba(255,255,255,0.6)" />
            <Text style={styles.meta}>{item.episodeCount} episodes · {item.totalHours}</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 14,
  },
  card: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
  },
  grad: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
    gap: 6,
  },
  catBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  catText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  meta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
});
