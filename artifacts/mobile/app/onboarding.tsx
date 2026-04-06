import { Icon } from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

let SCREEN_W = Dimensions.get("window").width;

const SLIDES = [
  {
    id: "1",
    icon: "headphones" as const,
    title: "Explore Islamic Stories",
    subtitle: "Prophets · Seerah · Sahaba · History",
    description:
      "Binge-listen to premium Islamic audio stories narrated with depth, accuracy, and reverence. Like Spotify — but for your deen.",
    accent: "#15803D",
    decorIcon: "star" as const,
  },
  {
    id: "2",
    icon: "quran" as const,
    title: "Listen to the Holy Qur'an",
    subtitle: "114 Surahs · Arabic Text · Multiple Reciters",
    description:
      "Experience the Qur'an as it was meant to be — beautifully recited, with Arabic text and English translation. Free for everyone. Forever.",
    accent: "#B8860E",
    decorIcon: "book-open" as const,
  },
  {
    id: "3",
    icon: "flag" as const,
    title: "Journey Through Islam",
    subtitle: "From Creation to the Khulafa Rashidun",
    description:
      "The Complete Story of Islam — a guided chronological journey through 20 chapters of Islamic history. No other app offers this.",
    accent: "#D4A030",
    decorIcon: "map" as const,
  },
];

function SlideItem({ item }: { item: (typeof SLIDES)[0] }) {
  const colors = useColors();
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        slideStyles.slide,
        { width: SCREEN_W, paddingTop: insets.top + (isWeb ? 67 : 0) + 32 },
      ]}
    >
      <View style={slideStyles.iconContainer}>
        <LinearGradient
          colors={[item.accent + "33", colors.background]}
          style={slideStyles.iconBg}
        >
          <Icon name={item.icon} size={64} color={item.accent} />
        </LinearGradient>
        <View style={[slideStyles.decorBadge, { backgroundColor: item.accent + "22", borderColor: item.accent + "44" }]}>
          <Icon name={item.decorIcon} size={18} color={item.accent} />
        </View>
      </View>

      <View style={slideStyles.textArea}>
        <Text style={[slideStyles.title, { color: colors.textPrimary }]}>
          {item.title}
        </Text>
        <Text style={[slideStyles.subtitle, { color: item.accent }]}>
          {item.subtitle}
        </Text>
        <Text style={[slideStyles.desc, { color: colors.textSecondary }]}>
          {item.description}
        </Text>
      </View>
    </View>
  );
}

const slideStyles = StyleSheet.create({
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 32,
  },
  iconContainer: {
    position: "relative",
  },
  iconBg: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  decorBadge: {
    position: "absolute",
    bottom: 4,
    right: -4,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  textArea: {
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  desc: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 4,
  },
});

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { completeOnboarding, continueAsGuest } = useAuth();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [index, setIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      SCREEN_W = window.width;
    });
    return () => sub?.remove();
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        indexRef.current = viewableItems[0].index;
        setIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const getItemLayout = useRef((_: any, itemIndex: number) => ({
    length: SCREEN_W,
    offset: SCREEN_W * itemIndex,
    index: itemIndex,
  })).current;

  const goNext = async () => {
    const current = indexRef.current;
    if (current < SLIDES.length - 1) {
      const next = current + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      indexRef.current = next;
      setIndex(next);
    } else {
      await completeOnboarding();
      router.replace("/login");
    }
  };

  const handleGuest = async () => {
    await completeOnboarding();
    await continueAsGuest();
    router.replace("/(tabs)");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SlideItem item={item} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        style={styles.slideList}
        scrollEnabled
        bounces={false}
      />

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + (isWeb ? 34 : 24) },
        ]}
      >
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? colors.gold : colors.border,
                  width: i === index ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={goNext}
          style={[styles.ctaBtn, { backgroundColor: colors.gold }]}
        >
          <Text style={styles.ctaText}>
            {index === SLIDES.length - 1 ? "Get Started" : "Next"}
          </Text>
          <Icon name="arrow-right" size={18} color="#fff" />
        </Pressable>

        <Pressable onPress={handleGuest} style={styles.guestBtn}>
          <Text style={[styles.guestText, { color: colors.textMuted }]}>
            Continue without account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slideList: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 16,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaBtn: {
    width: "100%",
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  guestBtn: {
    padding: 8,
  },
  guestText: {
    fontSize: 14,
  },
});
