import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

const BG = "#0C3222";
const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8D5A0";
const TEXT_PRIMARY = "#F5F5F5";
const TEXT_MUTED = "rgba(255,255,255,0.45)";

export function SplashLoader() {
  const bismillahOpacity = useRef(new Animated.Value(0)).current;
  const bismillahScale = useRef(new Animated.Value(0.92)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameY = useRef(new Animated.Value(16)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const ornamentOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(ornamentOpacity, { toValue: 0.35, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(bismillahOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(bismillahScale, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 90, friction: 7, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.25, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(nameOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(nameY, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ornamentRow, { opacity: ornamentOpacity }]}>
        <View style={styles.ornamentLine} />
        <View style={styles.ornamentDiamond} />
        <View style={styles.ornamentLine} />
      </Animated.View>

      <Animated.Text
        style={[
          styles.bismillah,
          { opacity: bismillahOpacity, transform: [{ scale: bismillahScale }] },
        ]}
      >
        بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
      </Animated.Text>

      <View style={styles.logoArea}>
        <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
        <Animated.View
          style={[
            styles.logoBox,
            { opacity: logoOpacity, transform: [{ scale: Animated.multiply(logoScale, pulse) }] },
          ]}
        >
          <Animated.Text style={styles.logoText}>SG</Animated.Text>
        </Animated.View>
      </View>

      <Animated.Text
        style={[
          styles.appName,
          { opacity: nameOpacity, transform: [{ translateY: nameY }] },
        ]}
      >
        StayGuided Me
      </Animated.Text>

      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Your Islamic Audio Companion
      </Animated.Text>

      <Animated.View style={[styles.ornamentRow, { opacity: ornamentOpacity, marginTop: 40 }]}>
        <View style={styles.ornamentLine} />
        <View style={styles.ornamentDiamond} />
        <View style={styles.ornamentLine} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
  },
  ornamentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
    gap: 14,
  },
  ornamentLine: {
    width: 48,
    height: 1,
    backgroundColor: GOLD_LIGHT,
    opacity: 0.35,
  },
  ornamentDiamond: {
    width: 7,
    height: 7,
    backgroundColor: GOLD,
    transform: [{ rotate: "45deg" }],
    opacity: 0.5,
  },
  bismillah: {
    fontSize: 24,
    color: GOLD_LIGHT,
    marginBottom: 30,
    letterSpacing: 2,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  logoArea: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  glow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: GOLD,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: GOLD,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 2,
  },
  logoText: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 2,
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    letterSpacing: 1,
    marginTop: 22,
  },
  tagline: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
