import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

const BG = "#0C3222";
const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8D5A0";
const GOLD_DIM = "rgba(201,168,76,0.18)";
const TEXT_PRIMARY = "#F5F5F5";
const TEXT_MUTED = "rgba(255,255,255,0.40)";
const TOTAL_DURATION = 3200;

export function SplashLoader() {
  const bgOpacity      = useRef(new Animated.Value(0)).current;
  const ornamentTop    = useRef(new Animated.Value(0)).current;
  const ornamentBot    = useRef(new Animated.Value(0)).current;
  const bismillahOp    = useRef(new Animated.Value(0)).current;
  const bismillahScale = useRef(new Animated.Value(0.88)).current;
  const glowOpacity    = useRef(new Animated.Value(0)).current;
  const glowScale      = useRef(new Animated.Value(0.6)).current;
  const logoOp         = useRef(new Animated.Value(0)).current;
  const logoScale      = useRef(new Animated.Value(0.4)).current;
  const nameOp         = useRef(new Animated.Value(0)).current;
  const nameY          = useRef(new Animated.Value(24)).current;
  const taglineOp      = useRef(new Animated.Value(0)).current;
  const taglineY       = useRef(new Animated.Value(12)).current;
  const barWidth       = useRef(new Animated.Value(0)).current;
  const barOp          = useRef(new Animated.Value(0)).current;
  const pulse          = useRef(new Animated.Value(1)).current;
  const shineOp        = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Phase 1 — background fade in (0–300ms)
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),

      // Phase 2 — ornaments slide in (300–700ms)
      Animated.parallel([
        Animated.timing(ornamentTop, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ornamentBot, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Phase 3 — Bismillah fades in (700–1050ms)
      Animated.parallel([
        Animated.timing(bismillahOp, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bismillahScale, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),

      // Phase 4 — Logo glow then logo (1050–1550ms)
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1.1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(80),
          Animated.parallel([
            Animated.timing(logoOp, {
              toValue: 1,
              duration: 420,
              useNativeDriver: true,
            }),
            Animated.spring(logoScale, {
              toValue: 1,
              tension: 100,
              friction: 6,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),

      // Phase 5 — App name slides up (1550–1850ms)
      Animated.parallel([
        Animated.timing(nameOp, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(nameY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Phase 6 — Tagline slides up (1850–2100ms)
      Animated.parallel([
        Animated.timing(taglineOp, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(taglineY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Phase 7 — Loading bar appears and fills (2100–3200ms)
      Animated.sequence([
        Animated.timing(barOp, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(barWidth, {
          toValue: 1,
          duration: TOTAL_DURATION - 2300,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    ]).start();

    // Pulse loop on logo (starts after logo appears)
    const pulseTimer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.055,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Shine blink on logo
      Animated.loop(
        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(shineOp, { toValue: 0.55, duration: 300, useNativeDriver: true }),
          Animated.timing(shineOp, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    }, 1400);

    return () => clearTimeout(pulseTimer);
  }, []);

  const barWidthInterpolated = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "68%"],
  });

  return (
    <Animated.View style={[styles.container, { opacity: bgOpacity }]}>
      {/* Top ornament */}
      <Animated.View
        style={[
          styles.ornamentRow,
          {
            opacity: ornamentTop,
            transform: [
              {
                translateY: ornamentTop.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.ornamentLine} />
        <View style={styles.ornamentStar} />
        <View style={[styles.ornamentLine, { width: 32 }]} />
        <View style={styles.ornamentDiamond} />
        <View style={[styles.ornamentLine, { width: 32 }]} />
        <View style={styles.ornamentStar} />
        <View style={styles.ornamentLine} />
      </Animated.View>

      {/* Bismillah */}
      <Animated.Text
        style={[
          styles.bismillah,
          {
            opacity: bismillahOp,
            transform: [{ scale: bismillahScale }],
          },
        ]}
      >
        بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
      </Animated.Text>

      {/* Logo area */}
      <View style={styles.logoArea}>
        {/* Glow ring */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />
        {/* Logo box */}
        <Animated.View
          style={[
            styles.logoBox,
            {
              opacity: logoOp,
              transform: [{ scale: Animated.multiply(logoScale, pulse) }],
            },
          ]}
        >
          <Animated.View style={[styles.logoShine, { opacity: shineOp }]} />
          <Animated.Text style={styles.logoText}>SG</Animated.Text>
        </Animated.View>
      </View>

      {/* App name */}
      <Animated.Text
        style={[
          styles.appName,
          {
            opacity: nameOp,
            transform: [{ translateY: nameY }],
          },
        ]}
      >
        StayGuided Me
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text
        style={[
          styles.tagline,
          {
            opacity: taglineOp,
            transform: [{ translateY: taglineY }],
          },
        ]}
      >
        Your Islamic Audio Companion
      </Animated.Text>

      {/* Bottom ornament */}
      <Animated.View
        style={[
          styles.ornamentRow,
          {
            opacity: ornamentBot,
            marginTop: 44,
            transform: [
              {
                translateY: ornamentBot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.ornamentLine} />
        <View style={styles.ornamentStar} />
        <View style={[styles.ornamentLine, { width: 32 }]} />
        <View style={styles.ornamentDiamond} />
        <View style={[styles.ornamentLine, { width: 32 }]} />
        <View style={styles.ornamentStar} />
        <View style={styles.ornamentLine} />
      </Animated.View>

      {/* Loading bar */}
      <Animated.View style={[styles.barTrack, { opacity: barOp }]}>
        <Animated.View style={[styles.barFill, { width: barWidthInterpolated }]} />
      </Animated.View>
    </Animated.View>
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
    gap: 10,
  },
  ornamentLine: {
    width: 44,
    height: 1,
    backgroundColor: GOLD_LIGHT,
    opacity: 0.3,
  },
  ornamentDiamond: {
    width: 7,
    height: 7,
    backgroundColor: GOLD,
    transform: [{ rotate: "45deg" }],
    opacity: 0.65,
  },
  ornamentStar: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: GOLD_LIGHT,
    opacity: 0.4,
  },
  bismillah: {
    fontSize: 22,
    color: GOLD_LIGHT,
    marginBottom: 32,
    letterSpacing: 2.5,
    textAlign: "center",
    paddingHorizontal: 24,
    opacity: 0.92,
  },
  logoArea: {
    width: 130,
    height: 130,
    justifyContent: "center",
    alignItems: "center",
  },
  glowRing: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: GOLD_DIM,
    borderWidth: 1.5,
    borderColor: "rgba(201,168,76,0.25)",
  },
  logoBox: {
    width: 90,
    height: 90,
    borderRadius: 26,
    backgroundColor: GOLD,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 2,
    overflow: "hidden",
  },
  logoShine: {
    position: "absolute",
    top: -10,
    left: -30,
    width: 60,
    height: 120,
    backgroundColor: "rgba(255,255,255,0.25)",
    transform: [{ rotate: "30deg" }],
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
    letterSpacing: 1.2,
    marginTop: 24,
  },
  tagline: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 8,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  barTrack: {
    position: "absolute",
    bottom: 60,
    width: 140,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(201,168,76,0.15)",
    overflow: "hidden",
  },
  barFill: {
    height: 2,
    borderRadius: 1,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
