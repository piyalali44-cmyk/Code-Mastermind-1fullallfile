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

const BAR_W = 130;

// ─── Islamic emblem SVG (120 × 120 viewBox, centre = 60, 60) ─────────────────
function IslamicEmblem() {
  const khatim =
    "60,38 63.83,50.76 75.56,44.44 69.24,56.17 82,60 69.24,63.83 " +
    "75.56,75.56 63.83,69.24 60,82 56.17,69.24 44.44,75.56 50.76,63.83 " +
    "38,60 50.76,56.17 44.44,44.44 56.17,50.76";

  const star =
    "79,34 81.94,40.96 89.46,41.6 83.76,46.55 85.47,53.9 " +
    "79,50 72.53,53.9 74.25,46.55 68.54,41.6 76.06,40.96";

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
  // Ornaments
  const topY  = useRef(new Animated.Value(-18)).current;
  const topOp = useRef(new Animated.Value(0)).current;
  const botY  = useRef(new Animated.Value(18)).current;
  const botOp = useRef(new Animated.Value(0)).current;

  // Bismillah
  const bisOp = useRef(new Animated.Value(0)).current;
  const bisSc = useRef(new Animated.Value(0.88)).current;

  // Logo glow
  const glowOp = useRef(new Animated.Value(0)).current;
  const glowSc = useRef(new Animated.Value(0.6)).current;

  // Logo emblem — single smooth fade+scale, NO spring
  const logoOp = useRef(new Animated.Value(0)).current;
  const logoSc = useRef(new Animated.Value(0.72)).current;

  // App name
  const nameOp = useRef(new Animated.Value(0)).current;
  const nameY  = useRef(new Animated.Value(16)).current;

  // Tagline
  const tagOp = useRef(new Animated.Value(0)).current;
  const tagY  = useRef(new Animated.Value(10)).current;

  // Progress bar — translateX approach so useNativeDriver: true is possible
  const barOp        = useRef(new Animated.Value(0)).current;
  const barTranslate = useRef(new Animated.Value(-BAR_W)).current;

  // Breath pulse for logo (very subtle)
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const smooth  = Easing.out(Easing.cubic);
    const silkIn  = Easing.bezier(0.25, 0.46, 0.45, 0.94); // smooth ease-out
    const elastic = Easing.bezier(0.34, 1.40, 0.64, 1);     // slight overshoot, clean

    const t = (val: Animated.Value, to: number, dur: number, e = smooth) =>
      Animated.timing(val, { toValue: to, duration: dur, easing: e, useNativeDriver: ND });

    Animated.sequence([
      // Phase 1 — ornaments slide in (0–260ms)
      Animated.parallel([
        t(topOp, 1, 260, silkIn), t(topY, 0, 260, silkIn),
        t(botOp, 1, 260, silkIn), t(botY, 0, 260, silkIn),
      ]),
      // Phase 2 — Bismillah fades in with gentle scale (260–580ms)
      Animated.parallel([
        t(bisOp, 1, 340, silkIn),
        t(bisSc, 1, 400, elastic),
      ]),
      // Phase 3 — Glow bloom + logo smooth reveal (580–1060ms)
      Animated.parallel([
        // Glow: expand and settle
        Animated.sequence([
          Animated.parallel([t(glowOp, 0.45, 180, silkIn), t(glowSc, 1.1,  180, silkIn)]),
          Animated.parallel([t(glowOp, 0.18, 300, silkIn), t(glowSc, 1.02, 300, silkIn)]),
        ]),
        // Logo: smooth entrance — NO spring, just a clean cubic
        Animated.sequence([
          Animated.delay(50),
          Animated.parallel([
            t(logoOp, 1, 400, silkIn),
            t(logoSc, 1, 460, elastic),
          ]),
        ]),
      ]),
      // Phase 4 — App name (1060–1360ms)
      Animated.parallel([t(nameOp, 1, 320, silkIn), t(nameY, 0, 320, silkIn)]),
      // Phase 5 — Tagline (1360–1590ms)
      Animated.parallel([t(tagOp, 1, 250, silkIn), t(tagY, 0, 250, silkIn)]),
      // Phase 6 — Progress bar slides in from left (1590–3400ms)
      // translateX: useNativeDriver: true → buttery smooth even under load
      Animated.parallel([
        t(barOp, 1, 180, silkIn),
        Animated.timing(barTranslate, {
          toValue: 0,
          duration: 1680,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: ND,
        }),
      ]),
    ]).start();

    // Very subtle breath pulse on the logo — starts after logo is visible
    const pulseTimer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.045,
            duration: 2600,
            easing: Easing.inOut(Easing.sine),
            useNativeDriver: ND,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 2600,
            easing: Easing.inOut(Easing.sine),
            useNativeDriver: ND,
          }),
        ])
      ).start();
    }, 1200);

    return () => clearTimeout(pulseTimer);
  }, []);

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
        <Animated.View style={{ opacity: logoOp, transform: [{ scale: Animated.multiply(logoSc, pulse) }] }}>
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

      {/* Progress bar — native-driver translateX slide */}
      <Animated.View style={[styles.barTrack, { opacity: barOp }]}>
        <Animated.View style={[styles.barFill, { transform: [{ translateX: barTranslate }] }]} />
      </Animated.View>

    </View>
  );
}

// ─── Ornament row ─────────────────────────────────────────────────────────────
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
    width: 170,
    height: 170,
    borderRadius: 85,
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
    width: BAR_W,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(201,168,76,0.15)",
    overflow: "hidden",
  },
  barFill: {
    width: BAR_W,
    height: 2,
    borderRadius: 1,
    backgroundColor: GOLD,
  },
});
