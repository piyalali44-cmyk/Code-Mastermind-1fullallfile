import { Icon } from "@/components/Icon";
import { BlurView } from "expo-blur";
import { Href, usePathname, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import FadeImage from "@/components/FadeImage";

const TABS: { name: string; route: Href; icon: "home" | "book-open" | "headphones" | "user" }[] = [
  { name: "Home", route: "/(tabs)", icon: "home" },
  { name: "Qur'an", route: "/(tabs)/quran", icon: "book-open" },
  { name: "Library", route: "/(tabs)/library", icon: "headphones" },
  { name: "Profile", route: "/(tabs)/profile", icon: "user" },
];

function MiniPlayerBar() {
  const colors = useColors();
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { nowPlaying, isPlaying, pause, resume, stop, playNext, position, duration } = useAudio();
  const slideAnim = useRef(new Animated.Value(80)).current;

  const isOnPlayer = pathname === "/player";

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: nowPlaying && !isOnPlayer ? 0 : 80,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [!!nowPlaying, isOnPlayer]);

  if (!nowPlaying || isOnPlayer) return null;

  const progress = duration > 0 ? position / duration : 0;

  const handlePlayPause = async () => {
    if (isPlaying) await pause();
    else await resume();
  };

  const handleClose = async () => {
    await stop();
  };

  const coverTint = nowPlaying.coverColor ? nowPlaying.coverColor + "18" : null;

  return (
    <Animated.View style={{ transform: [{ translateY: slideAnim }], paddingHorizontal: 10, marginBottom: 4 }}>
      <Pressable
        onPress={() => router.push("/player")}
        style={[styles.miniPlayer, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}
      >
        {coverTint && theme === "dark" && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: coverTint, borderRadius: 16 }]} />
        )}
        <View style={styles.miniRow}>
          <View style={[styles.miniCover, { backgroundColor: theme === "dark" ? (nowPlaying.coverColor || colors.surfaceExtraHigh) : colors.surfaceExtraHigh }]}>
            {nowPlaying.coverUrl ? (
              <FadeImage uri={nowPlaying.coverUrl} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
            ) : (
              <Icon name={nowPlaying.type === "quran" ? "book-open" : "headphones"} size={16} color={colors.goldLight} />
            )}
          </View>
          <View style={styles.miniInfo}>
            <Text style={[styles.miniTitle, { color: colors.textPrimary }]} numberOfLines={1}>{nowPlaying.title}</Text>
            <Text style={[styles.miniSub, { color: colors.textSecondary }]} numberOfLines={1}>{nowPlaying.seriesName}</Text>
          </View>
          <Pressable onPress={handlePlayPause} style={[styles.miniBtn, styles.miniPlayBtn, { backgroundColor: colors.gold }]} hitSlop={8}>
            <Icon name={isPlaying ? "pause" : "play"} size={18} color="#fff" />
          </Pressable>
          <Pressable onPress={() => playNext()} style={styles.miniBtn} hitSlop={8}>
            <Icon name="skip-forward" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={handleClose} style={[styles.miniBtn, styles.miniCloseBtn]} hitSlop={10}>
            <Icon name="x" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={[styles.miniProgress, { backgroundColor: colors.divider }]}>
          <View style={[styles.miniProgressFill, { width: `${progress * 100}%`, backgroundColor: colors.gold }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function TabButton({ tab, active }: { tab: typeof TABS[0]; active: boolean }) {
  const colors = useColors();
  const router = useRouter();

  const handlePress = () => {
    router.replace(tab.route);
  };

  return (
    <Pressable onPress={handlePress} style={styles.tabItem}>
      <View style={styles.tabInner}>
        {active && (
          <View style={[styles.activeIndicator, { backgroundColor: colors.gold }]} />
        )}
        <Icon name={tab.icon} size={22} color={active ? colors.goldLight : colors.textMuted} />
        <Text style={[styles.tabLabel, { color: active ? colors.goldLight : colors.textMuted, fontWeight: active ? "700" : "400" }]}>
          {tab.name}
        </Text>
      </View>
    </Pressable>
  );
}

function BottomTabBar() {
  const colors = useColors();
  const { theme } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const isActive = (route: Href) => {
    const routeStr = typeof route === "string" ? route : String(route);
    if (routeStr === "/(tabs)") {
      // Home tab is active on "/" , "/(tabs)" and "/(tabs)/" but NOT on sub-paths like /quran
      return pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/" || pathname === "/index";
    }
    const normalized = routeStr.replace("/(tabs)", "");
    return pathname === normalized || pathname.startsWith(normalized + "/");
  };

  return (
    <View style={[styles.tabBar, { borderTopColor: colors.border, paddingBottom: insets.bottom || (isWeb ? 8 : 4) }]}>
      {isIOS && <BlurView intensity={80} tint={theme === "light" ? "light" : "dark"} style={StyleSheet.absoluteFill} />}
      {!isIOS && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />}
      {TABS.map((tab) => (
        <TabButton key={tab.name} tab={tab} active={isActive(tab.route)} />
      ))}
    </View>
  );
}

export function PersistentChrome() {
  const pathname = usePathname();

  const hideChrome =
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/reset-password");

  if (hideChrome) return null;

  return (
    // box-none lets touches pass through the container to scroll views,
    // while MiniPlayerBar and BottomTabBar (children) still receive touches.
    <View style={[styles.chromeWrapper, { pointerEvents: "box-none" }]}>
      <View style={{ pointerEvents: "box-none" }}>
        <MiniPlayerBar />
      </View>
      <View style={{ pointerEvents: "auto" }}>
        <BottomTabBar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chromeWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  miniPlayer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  miniProgress: {
    height: 3,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: "hidden",
  },
  miniProgressFill: {
    height: 3,
  },
  miniRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  miniCover: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  miniInfo: {
    flex: 1,
  },
  miniTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  miniSub: {
    fontSize: 11,
    marginTop: 1,
  },
  miniBtn: {
    padding: 6,
  },
  miniPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  miniCloseBtn: {
    marginLeft: 0,
    opacity: 0.6,
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    paddingTop: 8,
    position: "relative",
    overflow: "hidden",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
  },
  tabInner: {
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
    position: "relative",
  },
  activeIndicator: {
    position: "absolute",
    top: -10,
    width: 24,
    height: 2,
    borderRadius: 1,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
