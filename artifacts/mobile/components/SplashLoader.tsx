import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polygon,
  Stop,
} from "react-native-svg";

const BG    = "#0C3222";
const GOLD  = "#C9A84C";
const GOLD2 = "#F2DC8C";
const GOLD3 = "#9A7228";
const CREAM = "#E8D5A0";
const CORE  = "#081C14";
const WHITE = "#F5F5F5";
const MUTED = "rgba(255,255,255,0.38)";

const ND = Platform.OS !== "web";

// ─── Islamic emblem SVG (120 × 120 viewBox, centre = 60, 60) ─────────────────
//
//  Layers (back → front):
//    1. Outer decorative ring (r=57, thin gold stroke)
//    2. 4 diamond accent marks at N/S/E/W
//    3. Inner decorative ring (r=47, very faint)
//    4. 8-pointed khatim star background (r_out=22, r_in=10, opacity 10%)
//    5. Dark-green core (r=40 filled)
//    6. Crescent moon (proper SVG arc path — mathematically exact)
//    7. 5-pointed star
//
//  Crescent geometry:
//    Gold arc circle: cx=48, cy=60, r=26
//    Mask arc circle: cx=63, cy=60, r=22
//    Intersection: x = (676-484-48²+63²) / (2*(63-48)) = 61.9
//                  y = 60 ± 43.97/2  →  ≈ (61.9, 38.0) and (61.9, 82.0)
//    Path: start at (61.9,38) → large CCW arc on r=26 circle → (61.9,82)
//          → small CW arc on r=22 circle back → (61.9,38)
//
//  5-pointed star: centre (79,45), R=11, r=5
//    Outer angles (deg): -90, -18, 54, 126, 198
//    Inner angles (deg): -54,  18, 90, 162, 234

function IslamicEmblem() {
  // ── Khatim (8-pointed star) background ── centre (60,60), R=22, r=10
  const khatim =
    "60,38 63.83,50.76 75.56,44.44 69.24,56.17 82,60 69.24,63.83 " +
    "75.56,75.56 63.83,69.24 60,82 56.17,69.24 44.44,75.56 50.76,63.83 " +
    "38,60 50.76,56.17 44.44,44.44 56.17,50.76";

  // ── 5-pointed star ── centre (79,45), R=11, r=5
  const star =
    "79,34 81.94,40.96 89.46,41.6 83.76,46.55 85.47,53.9 " +
    "79,50 72.53,53.9 74.25,46.55 68.54,41.6 76.06,40.96";

  // ── Crescent arc path (mathematically precise) ──
  const crescent =
    "M 61.9 38 A 26 26 0 1 0 61.9 82 A 22 22 0 0 1 61.9 38 Z";

  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id="gold" x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0%"   stopColor={GOLD2} />
          <Stop offset="50%"  stopColor={GOLD}  />
          <Stop offset="100%" stopColor={GOLD3} />
        </LinearGradient>
        <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%"   stopColor={GOLD2} stopOpacity={0.6} />
          <Stop offset="100%" stopColor={GOLD3} stopOpacity={0.2} />
        </LinearGradient>
      </Defs>

      {/* 1. Outer ring */}
      <Circle cx="60" cy="60" r="57"
        stroke="url(#ring)" strokeWidth="1.5" fill="none" />

      {/* 2. Diamond accents */}
      <Polygon points="60,2   62.5,5.5  60,9   57.5,5.5"  fill={GOLD} opacity="0.7" />
      <Polygon points="60,111 62.5,114.5 60,118 57.5,114.5" fill={GOLD} opacity="0.7" />
      <Polygon points="2,60  5.5,62.5  9,60  5.5,57.5"   fill={GOLD} opacity="0.7" />
      <Polygon points="111,60 114.5,62.5 118,60 114.5,57.5" fill={GOLD} opacity="0.7" />

      {/* 3. Inner ring */}
      <Circle cx="60" cy="60" r="47"
        stroke="url(#ring)" strokeWidth="0.7" fill="none" opacity="0.38" />

      {/* 4. Khatim background */}
      <Polygon points={khatim} fill="url(#gold)" opacity="0.12" />

      {/* 5. Core */}
      <Circle cx="60" cy="60" r="40" fill={CORE} />
      <Circle cx="60" cy="60" r="40"
        stroke="url(#gold)" strokeWidth="1.1" fill="none" opacity="0.38" />

      {/* 6. Crescent (arc path) */}
      <Path d={crescent} fill="url(#gold)" />

      {/* 7. 5-pointed star */}
      <Polygon points={star} fill="url(#gold)" />
    </Svg>
  );
}

// ─── Main SplashLoader ───────────────────────────────────────────────────────
export function SplashLoader() {
  const topY    = useRef(new Animated.Value(-20)).current;
  const topOp   = useRef(new Animated.Value(0)).current;
  const botY    = useRef(new Animated.Value(20)).current;
  const botOp   = useRef(new Animated.Value(0)).current;
  const bisOp   = useRef(new Animated.Value(0)).current;
  const bisSc   = useRef(new Animated.Value(0.82)).current;
  const glowOp  = useRef(new Animated.Value(0)).current;
  const glowSc  = useRef(new Animated.Value(0.5)).current;
  const logoOp  = useRef(new Animated.Value(0)).current;
  const logoSc  = useRef(new Animated.Value(0.3)).current;
  const nameOp  = useRef(new Animated.Value(0)).current;
  const nameY   = useRef(new Animated.Value(22)).current;
  const tagOp   = useRef(new Animated.Value(0)).current;
  const tagY    = useRef(new Animated.Value(14)).current;
  const barOp   = useRef(new Animated.Value(0)).current;
  const barProg = useRef(new Animated.Value(0)).current;
  const pulse   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const t = (val: Animated.Value, to: number, dur: number, e = ease) =>
      Animated.timing(val, { toValue: to, duration: dur, easing: e, useNativeDriver: ND });

    Animated.sequence([
      // Phase 1 — ornaments (0–240ms)
      Animated.parallel([
        t(topOp, 1, 240), t(topY, 0, 240),
        t(botOp, 1, 240), t(botY, 0, 240),
      ]),
      // Phase 2 — Bismillah (240–530ms)
      Animated.parallel([
        t(bisOp, 1, 320),
        t(bisSc, 1, 380, Easing.out(Easing.back(1.3))),
      ]),
      // Phase 3 — Glow burst + logo spring (530–1010ms)
      Animated.parallel([
        Animated.sequence([
          t(glowOp, 0.55, 200), t(glowSc, 1.15, 200, ease),
          t(glowOp, 0.22, 280), t(glowSc, 1.04, 280, ease),
        ]),
        Animated.sequence([
          Animated.delay(60),
          Animated.parallel([
            t(logoOp, 1, 380),
            Animated.spring(logoSc, { toValue: 1, tension: 120, friction: 6, useNativeDriver: ND }),
          ]),
        ]),
      ]),
      // Phase 4 — App name (1010–1320ms)
      Animated.parallel([t(nameOp, 1, 320), t(nameY, 0, 320)]),
      // Phase 5 — Tagline (1320–1560ms)
      Animated.parallel([t(tagOp, 1, 260), t(tagY, 0, 260)]),
      // Phase 6 — Loading bar (1560–3400ms)
      Animated.parallel([
        t(barOp, 1, 200),
        Animated.timing(barProg, {
          toValue: 1, duration: 1700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    ]).start();

    // Logo pulse loop (starts after logo appears)
    const timer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.055, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: ND }),
          Animated.timing(pulse, { toValue: 1,     duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: ND }),
        ])
      ).start();
    }, 1100);
    return () => clearTimeout(timer);
  }, []);

  const barW      = barProg.interpolate({ inputRange: [0, 1], outputRange: ["0%", "68%"] });
  const logoScale = Animated.multiply(logoSc, pulse);

  return (
    <View style={styles.root}>

      {/* Top ornament */}
      <Animated.View style={[styles.ornRow, { opacity: topOp, transform: [{ translateY: topY }] }]}>
        <OrnRow />
      </Animated.View>

      {/* Bismillah */}
      <Animated.Text style={[styles.bismillah, { opacity: bisOp, transform: [{ scale: bisSc }] }]}>
        بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
      </Animated.Text>

      {/* Logo + glow */}
      <View style={styles.logoOuter}>
        <Animated.View
          style={[styles.glow, { opacity: glowOp, transform: [{ scale: glowSc }], pointerEvents: "none" }]}
        />
        <Animated.View style={{ opacity: logoOp, transform: [{ scale: logoScale }] }}>
          <IslamicEmblem />
        </Animated.View>
      </View>

      {/* App name */}
      <Animated.Text style={[styles.appName, { opacity: nameOp, transform: [{ translateY: nameY }] }]}>
        StayGuided Me
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: tagOp, transform: [{ translateY: tagY }] }]}>
        Your Islamic Audio Companion
      </Animated.Text>

      {/* Bottom ornament */}
      <Animated.View style={[styles.ornRow, { opacity: botOp, transform: [{ translateY: botY }], marginTop: 36 }]}>
        <OrnRow />
      </Animated.View>

      {/* Loading bar */}
      <Animated.View style={[styles.barTrack, { opacity: barOp }]}>
        <Animated.View style={[styles.barFill, { width: barW }]} />
      </Animated.View>
    </View>
  );
}

// Ornament row
function OrnRow() {
  return (
    <>
      <View style={s.lineL} />
      <View style={s.dot} />
      <View style={s.lineSh} />
      <View style={s.diamond} />
      <View style={s.lineSh} />
      <View style={s.dot} />
      <View style={s.lineL} />
    </>
  );
}

const s = StyleSheet.create({
  lineL:   { width: 40, height: 1, backgroundColor: CREAM, opacity: 0.24 },
  lineSh:  { width: 22, height: 1, backgroundColor: CREAM, opacity: 0.20 },
  dot:     { width: 3, height: 3, borderRadius: 1.5, backgroundColor: CREAM, opacity: 0.36 },
  diamond: { width: 7, height: 7, backgroundColor: GOLD, transform: [{ rotate: "45deg" }], opacity: 0.72 },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
  },
  ornRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
    gap: 8,
  },
  bismillah: {
    fontSize: 20,
    color: CREAM,
    marginBottom: 26,
    letterSpacing: 2,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  logoOuter: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  glow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: GOLD,
  },
  appName: {
    fontSize: 25,
    fontWeight: "700",
    color: WHITE,
    letterSpacing: 1.3,
    marginTop: 20,
  },
  tagline: {
    fontSize: 10,
    color: MUTED,
    marginTop: 7,
    letterSpacing: 3.5,
    textTransform: "uppercase",
  },
  barTrack: {
    position: "absolute",
    bottom: 58,
    width: 120,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: "rgba(201,168,76,0.15)",
    overflow: "hidden",
  },
  barFill: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: GOLD,
  },
});
