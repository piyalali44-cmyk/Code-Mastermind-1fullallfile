import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

const BG       = "#0C3222";
const BG_DEEP  = "#081C14";
const GOLD     = "#C9A84C";
const GOLD_LT  = "#E8D5A0";
const GOLD_DIM = "rgba(201,168,76,0.12)";
const WHITE    = "#F5F5F5";
const MUTED    = "rgba(255,255,255,0.38)";

/** Islamic crescent logo built entirely from View primitives */
function IslamicEmblem({ scale, opacity }: { scale: Animated.AnimatedInterpolation<number> | Animated.Value; opacity: Animated.Value }) {
  return (
    <Animated.View style={[styles.emblemWrap, { opacity, transform: [{ scale }] }]}>
      {/* Outer decorative ring */}
      <View style={styles.ringOuter} />
      {/* Middle decorative ring */}
      <View style={styles.ringMid} />
      {/* Filled core */}
      <View style={styles.core}>
        {/* 8-pointed star background (two overlapping rotated rects) */}
        <View style={[styles.starBar, { transform: [{ rotate: "0deg" }] }]} />
        <View style={[styles.starBar, { transform: [{ rotate: "45deg" }] }]} />
        <View style={[styles.starBar, { transform: [{ rotate: "90deg" }] }]} />
        <View style={[styles.starBar, { transform: [{ rotate: "135deg" }] }]} />

        {/* Crescent moon */}
        <View style={styles.crescentWrap}>
          <View style={styles.crescentFull} />
          <View style={styles.crescentCut} />
        </View>

        {/* Small star to the right of crescent */}
        <View style={styles.starDot}>
          <View style={[styles.starPetal, { transform: [{ rotate: "0deg" }] }]} />
          <View style={[styles.starPetal, { transform: [{ rotate: "90deg" }] }]} />
        </View>
      </View>

      {/* 4 corner dots on the outer ring */}
      <View style={[styles.cornerDot, { top: -2, left: "50%", marginLeft: -2 }]} />
      <View style={[styles.cornerDot, { bottom: -2, left: "50%", marginLeft: -2 }]} />
      <View style={[styles.cornerDot, { left: -2, top: "50%", marginTop: -2 }]} />
      <View style={[styles.cornerDot, { right: -2, top: "50%", marginTop: -2 }]} />
    </Animated.View>
  );
}

export function SplashLoader() {
  /* ── Animated values ── */
  const bgValue        = useRef(new Animated.Value(0)).current;
  const topOrnOp       = useRef(new Animated.Value(0)).current;
  const topOrnY        = useRef(new Animated.Value(-18)).current;
  const botOrnOp       = useRef(new Animated.Value(0)).current;
  const botOrnY        = useRef(new Animated.Value(18)).current;
  const bismillahOp    = useRef(new Animated.Value(0)).current;
  const bismillahSc    = useRef(new Animated.Value(0.84)).current;
  const glowOp         = useRef(new Animated.Value(0)).current;
  const glowSc         = useRef(new Animated.Value(0.5)).current;
  const emblemOp       = useRef(new Animated.Value(0)).current;
  const emblemSc       = useRef(new Animated.Value(0.38)).current;
  const nameOp         = useRef(new Animated.Value(0)).current;
  const nameY          = useRef(new Animated.Value(22)).current;
  const taglineOp      = useRef(new Animated.Value(0)).current;
  const taglineY       = useRef(new Animated.Value(14)).current;
  const barOp          = useRef(new Animated.Value(0)).current;
  const barProg        = useRef(new Animated.Value(0)).current;
  const pulse          = useRef(new Animated.Value(1)).current;
  const shineOp        = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      /* Phase 1 — background (0–280ms) */
      Animated.timing(bgValue, { toValue: 1, duration: 280, useNativeDriver: true }),

      /* Phase 2 — ornaments slide in (280–620ms) */
      Animated.parallel([
        Animated.timing(topOrnOp, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(topOrnY,  { toValue: 0,  duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(botOrnOp, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(botOrnY,  { toValue: 0,  duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),

      /* Phase 3 — Bismillah (620–980ms) */
      Animated.parallel([
        Animated.timing(bismillahOp, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bismillahSc, { toValue: 1, duration: 480, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      ]),

      /* Phase 4 — Glow burst then emblem (980–1520ms) */
      Animated.parallel([
        Animated.timing(glowOp, { toValue: 0.65, duration: 260, useNativeDriver: true }),
        Animated.timing(glowSc, { toValue: 1.2,  duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(100),
          Animated.parallel([
            Animated.timing(emblemOp, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.spring(emblemSc, { toValue: 1, tension: 110, friction: 6, useNativeDriver: true }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(320),
          Animated.timing(glowOp, { toValue: 0.28, duration: 300, useNativeDriver: true }),
          Animated.timing(glowSc, { toValue: 1.05, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),

      /* Phase 5 — App name slides up (1520–1860ms) */
      Animated.parallel([
        Animated.timing(nameOp, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(nameY,  { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),

      /* Phase 6 — Tagline (1860–2100ms) */
      Animated.parallel([
        Animated.timing(taglineOp, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(taglineY,  { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),

      /* Phase 7 — Loading bar fills (2100–3400ms) */
      Animated.parallel([
        Animated.timing(barOp,   { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(barProg, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      ]),
    ]).start();

    /* Pulse & shine loops (start after emblem appears) */
    const t = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.delay(1400),
          Animated.timing(shineOp, { toValue: 0.7, duration: 280, useNativeDriver: true }),
          Animated.timing(shineOp, { toValue: 0,   duration: 380, useNativeDriver: true }),
        ])
      ).start();
    }, 1300);

    return () => clearTimeout(t);
  }, []);

  const barWidth = barProg.interpolate({ inputRange: [0, 1], outputRange: ["0%", "72%"] });
  const emblemScale = Animated.multiply(emblemSc, pulse);

  return (
    <Animated.View style={[styles.root, { opacity: bgValue }]}>

      {/* Top ornament */}
      <Animated.View style={[styles.ornRow, { opacity: topOrnOp, transform: [{ translateY: topOrnY }] }]}>
        <View style={styles.line} />
        <View style={styles.dot} />
        <View style={[styles.line, styles.lineShort]} />
        <View style={styles.diamond} />
        <View style={[styles.line, styles.lineShort]} />
        <View style={styles.dot} />
        <View style={styles.line} />
      </Animated.View>

      {/* Bismillah */}
      <Animated.Text style={[styles.bismillah, { opacity: bismillahOp, transform: [{ scale: bismillahSc }] }]}>
        بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
      </Animated.Text>

      {/* Glow halo */}
      <Animated.View
        style={[styles.glow, { opacity: glowOp, transform: [{ scale: glowSc }] }]}
        pointerEvents="none"
      />

      {/* Islamic emblem */}
      <IslamicEmblem scale={emblemScale} opacity={emblemOp} />

      {/* Shine overlay on emblem */}
      <Animated.View style={[styles.shineOverlay, { opacity: shineOp }]} pointerEvents="none" />

      {/* App name */}
      <Animated.Text style={[styles.appName, { opacity: nameOp, transform: [{ translateY: nameY }] }]}>
        StayGuided Me
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOp, transform: [{ translateY: taglineY }] }]}>
        Your Islamic Audio Companion
      </Animated.Text>

      {/* Bottom ornament */}
      <Animated.View style={[styles.ornRow, { opacity: botOrnOp, transform: [{ translateY: botOrnY }], marginTop: 40 }]}>
        <View style={styles.line} />
        <View style={styles.dot} />
        <View style={[styles.line, styles.lineShort]} />
        <View style={styles.diamond} />
        <View style={[styles.line, styles.lineShort]} />
        <View style={styles.dot} />
        <View style={styles.line} />
      </Animated.View>

      {/* Loading bar */}
      <Animated.View style={[styles.barTrack, { opacity: barOp }]}>
        <Animated.View style={[styles.barFill, { width: barWidth }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── Ornaments ── */
  ornRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 26,
    gap: 9,
  },
  line: {
    width: 46,
    height: 1,
    backgroundColor: GOLD_LT,
    opacity: 0.28,
  },
  lineShort: { width: 28 },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: GOLD_LT,
    opacity: 0.4,
  },
  diamond: {
    width: 7,
    height: 7,
    backgroundColor: GOLD,
    transform: [{ rotate: "45deg" }],
    opacity: 0.7,
  },

  /* ── Bismillah ── */
  bismillah: {
    fontSize: 21,
    color: GOLD_LT,
    marginBottom: 30,
    letterSpacing: 2,
    textAlign: "center",
    paddingHorizontal: 24,
    opacity: 0.9,
  },

  /* ── Glow halo ── */
  glow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: GOLD,
    /* Positioned via JS — it hovers at the emblem center */
  },

  /* ── Emblem ── */
  emblemWrap: {
    width: 110,
    height: 110,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  ringOuter: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.2,
    borderColor: GOLD,
    opacity: 0.45,
  },
  ringMid: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 0.7,
    borderColor: GOLD_LT,
    opacity: 0.25,
  },
  core: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: BG_DEEP,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 0.8,
    borderColor: "rgba(201,168,76,0.3)",
  },
  /* 8-pointed star bars (background pattern, very low opacity) */
  starBar: {
    position: "absolute",
    width: 68,
    height: 8,
    backgroundColor: GOLD_DIM,
    borderRadius: 4,
  },
  /* Crescent */
  crescentWrap: {
    position: "absolute",
    width: 36,
    height: 36,
    left: 10,
    top: 19,
  },
  crescentFull: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GOLD,
  },
  crescentCut: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BG_DEEP,
    top: 3,
    left: 9,
  },
  /* 4-pointed star */
  starDot: {
    position: "absolute",
    width: 10,
    height: 10,
    top: 20,
    right: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  starPetal: {
    position: "absolute",
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: GOLD,
    opacity: 0.95,
  },
  /* Corner accent dots on the outer ring */
  cornerDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: GOLD,
    opacity: 0.5,
  },

  /* ── Shine sweep ── */
  shineOverlay: {
    position: "absolute",
    width: 60,
    height: 130,
    backgroundColor: "rgba(255,255,255,0.15)",
    transform: [{ rotate: "30deg" }],
    zIndex: 3,
    borderRadius: 4,
  },

  /* ── App name ── */
  appName: {
    fontSize: 26,
    fontWeight: "700",
    color: WHITE,
    letterSpacing: 1.4,
    marginTop: 22,
  },

  /* ── Tagline ── */
  tagline: {
    fontSize: 10,
    color: MUTED,
    marginTop: 7,
    letterSpacing: 3.5,
    textTransform: "uppercase",
  },

  /* ── Loading bar ── */
  barTrack: {
    position: "absolute",
    bottom: 56,
    width: 130,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: "rgba(201,168,76,0.12)",
    overflow: "hidden",
  },
  barFill: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
});
