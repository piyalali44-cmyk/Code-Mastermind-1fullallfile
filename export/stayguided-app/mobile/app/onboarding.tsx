import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
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

import { Icon } from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

let SCREEN_W = Dimensions.get("window").width;
let SCREEN_H = Dimensions.get("window").height;

const SLIDES = [
  {
    id: "1",
    icon: "headphones" as const,
    tag: "AUDIO LIBRARY",
    title: "Explore Islamic Stories",
    description:
      "Discover the profound depth of Islamic history and wisdom through beautifully narrated audio stories — crafted with scholarly accuracy, reverence, and care.",
    pillars: ["Prophets & Messengers", "Seerah", "Sahaba", "Islamic History"],
    accent: "#15803D",
    accentLight: "#22c55e",
    gradientStart: "#0a1f0f",
    gradientEnd: "#071a0b",
  },
  {
    id: "2",
    icon: "quran" as const,
    tag: "THE HOLY QUR'AN",
    title: "Listen to the Holy Qur'an",
    description:
      "Experience the words of Allah ﷻ through the recitations of world-renowned Qurra' — accompanied by Arabic text and translation, available freely to all.",
    pillars: ["Arabic Recitation", "English Translation", "Multiple Reciters"],
    accent: "#B8860E",
    accentLight: "#F0B429",
    gradientStart: "#1a1400",
    gradientEnd: "#120f00",
  },
  {
    id: "3",
    icon: "flag" as const,
    tag: "GUIDED LEARNING",
    title: "Journey Through Islam",
    description:
      "Embark on a thoughtfully curated journey through Islamic history — from the creation of the heavens and earth to the era of the Rightly Guided Caliphs.",
    pillars: ["Creation & Prophets", "Life of the Prophet ﷺ", "Khulafa Rashidun"],
    accent: "#C07D1A",
    accentLight: "#E8A020",
    gradientStart: "#1a1100",
    gradientEnd: "#110d00",
  },
];

function DecorativeRings({ accent }: { accent: string }) {
  return (
    <>
      <View style={[decorStyles.ring, decorStyles.ring1, { borderColor: accent + "18" }]} />
      <View style={[decorStyles.ring, decorStyles.ring2, { borderColor: accent + "12" }]} />
      <View style={[decorStyles.ring, decorStyles.ring3, { borderColor: accent + "08" }]} />
    </>
  );
}

const decorStyles = StyleSheet.create({
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "center",
  },
  ring1: {
    width: 200,
    height: 200,
    top: -20,
    left: "50%" as any,
    marginLeft: -100,
  },
  ring2: {
    width: 280,
    height: 280,
    top: -60,
    left: "50%" as any,
    marginLeft: -140,
  },
  ring3: {
    width: 360,
    height: 360,
    top: -100,
    left: "50%" as any,
    marginLeft: -180,
  },
});

function SlideItem({ item, active }: { item: (typeof SLIDES)[0]; active: boolean }) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
    }
  }, [active]);

  return (
    <View style={[slideStyles.slide, { width: SCREEN_W, paddingTop: insets.top + (isWeb ? 67 : 0) }]}>
      <View style={slideStyles.topSection}>
        <DecorativeRings accent={item.accent} />

        <Animated.View style={[slideStyles.iconWrapper, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={[item.accent + "30", item.accent + "08", "transparent"]}
            style={slideStyles.iconGlow}
          />
          <View style={[slideStyles.iconCircleOuter, { borderColor: item.accent + "25" }]}>
            <View style={[slideStyles.iconCircleInner, { borderColor: item.accent + "40" }]}>
              <LinearGradient
                colors={[item.accent + "30", item.accent + "15"]}
                style={slideStyles.iconCircleCore}
              >
                <Icon name={item.icon} size={52} color={item.accent} />
              </LinearGradient>
            </View>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[slideStyles.textSection, { opacity: opacityAnim }]}>
        <View style={[slideStyles.tagPill, { backgroundColor: item.accent + "18", borderColor: item.accent + "30" }]}>
          <View style={[slideStyles.tagDot, { backgroundColor: item.accentLight }]} />
          <Text style={[slideStyles.tagText, { color: item.accentLight }]}>{item.tag}</Text>
        </View>

        <Text style={slideStyles.title}>{item.title}</Text>

        <Text style={slideStyles.description}>{item.description}</Text>

        <View style={slideStyles.pillarsRow}>
          {item.pillars.map((p, i) => (
            <View key={i} style={[slideStyles.pillar, { backgroundColor: item.accent + "14", borderColor: item.accent + "22" }]}>
              <Text style={[slideStyles.pillarText, { color: item.accent }]}>{p}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const slideStyles = StyleSheet.create({
  slide: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingBottom: 20,
    justifyContent: "space-between",
  },
  topSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    position: "relative",
    minHeight: 260,
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  iconCircleOuter: {
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleCore: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  textSection: {
    alignItems: "center",
    width: "100%",
    gap: 14,
    paddingBottom: 8,
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    color: "#FFFFFF",
    lineHeight: 33,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14.5,
    textAlign: "center",
    color: "rgba(255,255,255,0.62)",
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  pillarsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 7,
    marginTop: 4,
  },
  pillar: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillarText: {
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 0.2,
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
      SCREEN_H = window.height;
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

  const currentSlide = SLIDES[index];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[currentSlide.gradientStart, currentSlide.gradientEnd, "#050505"]}
        style={StyleSheet.absoluteFillObject}
      />

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index: i }) => (
          <SlideItem item={item} active={i === index} />
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        style={styles.slideList}
        scrollEnabled
        bounces={false}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + (isWeb ? 34 : 20) }]}>
        <View style={styles.dotsRow}>
          {SLIDES.map((s, i) => (
            <Pressable
              key={i}
              onPress={() => {
                flatListRef.current?.scrollToIndex({ index: i, animated: true });
                indexRef.current = i;
                setIndex(i);
              }}
            >
              <View
                style={[
                  styles.dot,
                  {
                    width: i === index ? 28 : 7,
                    backgroundColor: i === index ? currentSlide.accentLight : "rgba(255,255,255,0.18)",
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={goNext} style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}>
          <LinearGradient
            colors={[currentSlide.accentLight, currentSlide.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>
              {index === SLIDES.length - 1 ? "Begin Your Journey" : "Continue"}
            </Text>
            <Icon name="arrow-right" size={18} color="#fff" />
          </LinearGradient>
        </Pressable>

        <Pressable onPress={handleGuest} style={styles.guestBtn} hitSlop={8}>
          <Text style={styles.guestText}>Explore without an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#060606",
  },
  slideList: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 14,
    alignItems: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    height: 7,
    borderRadius: 3.5,
  },
  ctaBtn: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  ctaBtnPressed: {
    opacity: 0.85,
  },
  ctaGradient: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  ctaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  guestBtn: {
    paddingVertical: 4,
  },
  guestText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.32)",
    fontWeight: "400",
  },
});
