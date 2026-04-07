import { Icon } from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FadeImage from "@/components/FadeImage";
import { Toast } from "@/components/Toast";
import { useAudio } from "@/context/AudioContext";
import { useAuth } from "@/context/AuthContext";
import { useContent } from "@/context/ContentContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useColors } from "@/hooks/useColors";
import { getRecentlyPlayed, type RecentlyPlayedItem } from "@/lib/db";

const { width: W } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_W = (W - 32 - CARD_GAP) / 2;
const CARD_H = CARD_W * 1.4;
const HEADER_H = 68;

// Deterministic shuffle using a numeric seed (changes daily for freshness)
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.abs(Math.floor(Math.sin(seed * 9301 + i * 49297) * 233280)) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Daily seed so feed feels fresh each day
function getDailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const FEED_PAGE_SIZE = 12;

// Ensure same series doesn't appear within MIN_GAP positions
function spreadFeedItems(items: any[], minGap = 5): any[] {
  const result: any[] = [];
  const recent: string[] = [];
  const remaining = [...items];

  while (remaining.length > 0) {
    let chosen = remaining.findIndex(item => !recent.includes(item.series.id));
    if (chosen === -1) chosen = 0;
    result.push(remaining[chosen]);
    recent.push(remaining[chosen].series.id);
    if (recent.length > minGap) recent.shift();
    remaining.splice(chosen, 1);
  }
  return result;
}

// Build the full ordered pool once — call this when series loads, then paginate linearly
function buildFeedPool(allSeries: any[], seed: number): any[] {
  const pool: any[] = [];
  for (const s of allSeries) {
    if (s.episodes && s.episodes.length > 0) {
      for (const ep of s.episodes) {
        pool.push({ series: s, episode: ep });
      }
    } else {
      pool.push({ series: s, episode: null });
    }
  }
  if (pool.length === 0) return [];
  const shuffled = seededShuffle(pool, seed);
  return spreadFeedItems(shuffled, 5);
}

function AnimatedPressable({ onPress, style, children }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() =>
        Animated.spring(scale, {
          toValue: 0.95,
          useNativeDriver: true,
          tension: 200,
          friction: 12,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 12,
        }).start()
      }
      onPress={onPress}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const StoryGridCard = React.memo(function StoryGridCard({
  item,
}: {
  item: { series: any; episode: any | null; key: string };
}) {
  const colors = useColors();
  const router = useRouter();
  const { settings } = useAppSettings();
  const scale = useRef(new Animated.Value(1)).current;

  const { series, episode } = item;
  const hasEpisode = episode !== null && episode !== undefined;

  return (
    <Pressable
      onPressIn={() =>
        Animated.spring(scale, {
          toValue: 0.96,
          useNativeDriver: true,
          tension: 200,
          friction: 12,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 12,
        }).start()
      }
      onPress={() => router.push(`/series/${series.id}`)}
    >
      <Animated.View
        style={[
          styles.gridCard,
          { width: CARD_W, height: CARD_H, transform: [{ scale }] },
        ]}
      >
        <View
          style={[
            styles.gridCoverBg,
            { backgroundColor: series.coverColor },
          ]}
        >
          {series.coverUrl ? (
            <FadeImage uri={series.coverUrl} style={StyleSheet.absoluteFill} />
          ) : (
            <>
              <View style={[styles.decorCircle1, { borderColor: "rgba(255,255,255,0.08)" }]} />
              <View style={[styles.decorCircle2, { borderColor: "rgba(255,255,255,0.05)" }]} />
              <Icon name="headphones" size={36} color="rgba(255,255,255,0.25)" style={styles.coverIcon} />
            </>
          )}
          <View style={styles.gridBadgeWrap}>
            <View
              style={[styles.gridBadge, { backgroundColor: "rgba(0,0,0,0.5)" }]}
            >
              <Text style={styles.gridBadgeText}>
                {series.category.toUpperCase()}
              </Text>
            </View>
          </View>
          {hasEpisode && episode.isPremium && settings.subscription_enabled && (
            <View style={styles.gridPremiumWrap}>
              <View
                style={[styles.gridPremiumBadge, { backgroundColor: "#B8860E" }]}
              >
                <Icon name="star" size={8} color="#fff" />
                <Text style={styles.gridPremiumText}>PRO</Text>
              </View>
            </View>
          )}
          {!hasEpisode && series.episodeCount > 0 && (
            <View style={styles.gridPremiumWrap}>
              <View
                style={[styles.gridPremiumBadge, { backgroundColor: "rgba(0,0,0,0.55)" }]}
              >
                <Icon name="layers" size={8} color="#fff" />
                <Text style={styles.gridPremiumText}>{series.episodeCount} EPS</Text>
              </View>
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.75)"]}
            style={styles.gridGrad}
          />
          <View style={styles.gridPlayBtn}>
            <Icon
              name={hasEpisode ? "play-circle" : "book-open"}
              size={32}
              color="rgba(255,255,255,0.9)"
            />
          </View>
        </View>
        <View style={[styles.gridInfo, { backgroundColor: colors.surface }]}>
          <Text
            style={[styles.gridEpTitle, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {series.title}
          </Text>
          <View style={styles.gridMeta}>
            <Icon name="headphones" size={10} color={colors.textMuted} />
            <Text style={[styles.gridDuration, { color: colors.textMuted }]}>
              {series.episodeCount > 0 ? `${series.episodeCount} eps` : "Series"}
            </Text>
            {series.totalHours && series.totalHours !== "0 hrs" && (
              <>
                <Text style={[styles.gridDot, { color: colors.textMuted }]}>·</Text>
                <Text style={[styles.gridEpNum, { color: colors.textMuted }]}>
                  {series.totalHours}
                </Text>
              </>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

function BannerDot({ active }: { active: boolean }) {
  const colors = useColors();
  const widthAnim = useRef(new Animated.Value(active ? 28 : 6)).current;
  const opacityAnim = useRef(new Animated.Value(active ? 1 : 0.35)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(widthAnim, { toValue: active ? 28 : 6, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: active ? 1 : 0.35, duration: 400, useNativeDriver: false }),
    ]).start();
  }, [active]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: colors.gold, width: widthAnim, opacity: opacityAnim },
      ]}
    />
  );
}

// ─── Per-card component with independent text reveal animation ─────────────────
const BANNER_CARD_W = W - 32;

function CarouselCard({
  item, isActive, index, scrollX, onPress,
}: {
  item: any; isActive: boolean; index: number; scrollX: Animated.Value; onPress: () => void;
}) {
  const colors = useColors();
  const textOpacity = useRef(new Animated.Value(isActive ? 1 : 0.5)).current;
  const textSlide = useRef(new Animated.Value(isActive ? 0 : 14)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      Animated.sequence([
        Animated.delay(120),
        Animated.parallel([
          Animated.timing(textOpacity, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(textSlide, { toValue: 0, tension: 90, friction: 12, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 0.4, duration: 200, useNativeDriver: true }),
        Animated.timing(textSlide, { toValue: 10, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [isActive]);

  const inputRange = [(index - 1) * BANNER_CARD_W, index * BANNER_CARD_W, (index + 1) * BANNER_CARD_W];
  const cardScale = scrollX.interpolate({ inputRange, outputRange: [0.92, 1, 0.92], extrapolate: "clamp" });
  const cardOpacity = scrollX.interpolate({ inputRange, outputRange: [0.55, 1, 0.55], extrapolate: "clamp" });

  return (
    <Animated.View style={{ width: BANNER_CARD_W, transform: [{ scale: cardScale }], opacity: cardOpacity }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 12 }).start()}
        onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 12 }).start()}
        style={[styles.bannerCard, { backgroundColor: item.coverColor }]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: btnScale }] }]}>
          {item.coverUrl ? (
            <FadeImage uri={item.coverUrl} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[styles.bannerDecorCircle, { borderColor: "rgba(255,255,255,0.06)" }]} />
          )}
        </Animated.View>
        <LinearGradient
          colors={["transparent", "rgba(6,12,22,0.55)", "rgba(6,12,22,0.97)"]}
          locations={[0, 0.45, 1]}
          style={styles.bannerGrad}
        >
          <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textSlide }] }}>
            <View style={[styles.bannerBadge, { backgroundColor: colors.gold, flexDirection: "row", alignItems: "center", gap: 4 }]}>
              <Text style={styles.bannerBadgeText}>✦ FEATURED</Text>
            </View>
            <Text style={styles.bannerTitle} numberOfLines={2}>{item.title}</Text>
            <View style={styles.bannerMetaRow}>
              <Icon name="headphones" size={12} color="rgba(255,255,255,0.6)" />
              <Text style={styles.bannerMeta}>{item.episodeCount} episodes · {item.totalHours}</Text>
            </View>
            <View style={styles.bannerCta}>
              <Icon name="play" size={11} color="#fff" />
              <Text style={styles.bannerCtaText}>Listen now</Text>
            </View>
          </Animated.View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Professional auto-advancing featured carousel (infinite loop) ─────────────
function FeaturedCarousel({ featured }: { featured: any[] }) {
  const router = useRouter();
  // Append a clone of the first card at the end for seamless forward loop
  const looped = featured.length > 1 ? [...featured, featured[0]] : featured;
  const [activeIdx, setActiveIdx] = useState(0);   // display dot index (0..featured.length-1)
  const [scrollIdx, setScrollIdx] = useState(0);   // actual scroll position index
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const isSilentSnap = useRef(false);

  // Advance to next card — always forward, never backwards
  const advanceTo = useCallback((nextScrollIdx: number, animated: boolean) => {
    scrollRef.current?.scrollTo({ x: nextScrollIdx * BANNER_CARD_W, animated });
    setScrollIdx(nextScrollIdx);
    setActiveIdx(nextScrollIdx % featured.length);
  }, [featured.length]);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    if (featured.length <= 1) return;
    timerRef.current = setInterval(() => {
      setScrollIdx((prev) => {
        const next = prev + 1; // always go forward
        scrollRef.current?.scrollTo({ x: next * BANNER_CARD_W, animated: true });
        setActiveIdx(next % featured.length);
        return next;
      });
    }, 4800);
  }, [featured.length]);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer]);

  if (featured.length === 0) return null;

  const handleMomentumEnd = (e: any) => {
    if (isSilentSnap.current) { isSilentSnap.current = false; return; }
    const rawIdx = Math.round(e.nativeEvent.contentOffset.x / BANNER_CARD_W);
    setActiveIdx(rawIdx % featured.length);
    setScrollIdx(rawIdx);

    // If user scrolled to the cloned-first card at the end, silently snap back to real index 0
    if (rawIdx >= featured.length) {
      isSilentSnap.current = true;
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: 0, animated: false });
        setScrollIdx(0);
      }, 32);
    }
    startTimer();
  };

  // Also handle auto-timer reaching the cloned card — reset silently
  useEffect(() => {
    if (scrollIdx >= featured.length) {
      const t = setTimeout(() => {
        isSilentSnap.current = true;
        scrollRef.current?.scrollTo({ x: 0, animated: false });
        // Also reset scrollX animated value so per-card interpolations stay correct
        scrollX.setValue(0);
        setScrollIdx(0);
      }, 480); // wait for scroll animation to finish (~400ms)
      return () => clearTimeout(t);
    }
  }, [scrollIdx, featured.length]);

  const goTo = useCallback((idx: number) => {
    clearInterval(timerRef.current);
    advanceTo(idx, true);
    startTimer();
  }, [advanceTo, startTimer]);

  return (
    <View style={{ gap: 12 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onScrollBeginDrag={() => clearInterval(timerRef.current)}
        onMomentumScrollEnd={handleMomentumEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        style={{ width: BANNER_CARD_W }}
      >
        {looped.map((item, i) => (
          <CarouselCard
            key={`${item.id}-${i}`}
            item={item}
            isActive={i === scrollIdx || (i === 0 && scrollIdx >= featured.length)}
            index={i}
            scrollX={scrollX}
            onPress={() => router.push(`/series/${item.id}`)}
          />
        ))}
      </ScrollView>
      {featured.length > 1 && (
        <View style={styles.dotsRow}>
          {featured.map((_, i) => (
            <Pressable key={i} onPress={() => goTo(i)} hitSlop={8}>
              <BannerDot active={i === activeIdx} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isGuest, pendingNotification, clearPendingNotification } = useAuth();
  const { nowPlaying } = useAudio();
  const { series: allSeries, loading: contentLoading } = useContent();
  const { featureFlags, settings } = useAppSettings();
  const [referralToast, setReferralToast] = useState<{ visible: boolean; xp: number }>({ visible: false, xp: 0 });
  const [continueItems, setContinueItems] = useState<RecentlyPlayedItem[]>([]);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const sessionSeed = useRef(getDailySeed()).current;
  const feedInitRef = useRef(false);
  const feedPoolRef = useRef<any[]>([]);   // full ordered pool for current cycle
  const feedOffsetRef = useRef(0);         // how many items already shown in current cycle
  const feedCycleRef = useRef(0);          // cycle counter — increments each time pool exhausts
  const feedTotalShownRef = useRef(0);     // global count for unique keys across cycles
  const shownKeysRef = useRef<Set<string>>(new Set()); // tracks shown item keys to prevent duplicates
  const loadingMoreRef = useRef(false);    // sync guard — no double-load

  const headerAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerVisible = useRef(true);
  const isWeb = Platform.OS === "web";
  const totalHeaderH = HEADER_H + insets.top + (isWeb ? 67 : 0);

  const featured = allSeries.filter((s) => s.isFeatured);
  const featuredIds = new Set(featured.map((s) => s.id));
  // Popular = highest play count, not already featured, max 6
  const popular = allSeries
    .filter((s) => !featuredIds.has(s.id))
    .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
    .slice(0, 6);
  const popularIds = new Set(popular.map((s) => s.id));
  // New Releases = genuinely new, not in featured or popular, max 6
  const newReleases = allSeries
    .filter((s) => s.isNew && !featuredIds.has(s.id) && !popularIds.has(s.id))
    .slice(0, 6);

  // Load real "Continue Listening" data when screen is focused
  useFocusEffect(useCallback(() => {
    if (!user?.id) { setContinueItems([]); return; }
    getRecentlyPlayed(user.id, 6).then(setContinueItems).catch(() => {});
  }, [user?.id]));

  // Show toast when referral code is successfully applied after signup
  useEffect(() => {
    if (pendingNotification?.type === "referral_applied") {
      setReferralToast({ visible: true, xp: pendingNotification.xp });
      clearPendingNotification();
    }
  }, [pendingNotification, clearPendingNotification]);

  // Build a fresh pool for the given cycle, excluding recently shown keys to prevent duplicates
  const buildNextPool = useCallback((cycle: number, recentKeys: Set<string>) => {
    const newSeed = sessionSeed + cycle * 7919; // large prime offset gives very different shuffles
    const pool = buildFeedPool(allSeries, newSeed);
    // Filter out items that were shown in the previous cycle (keeps boundary fresh)
    return pool.filter(item => {
      const k = `${item.series.id}::${item.episode?.id ?? "null"}`;
      return !recentKeys.has(k);
    });
  }, [allSeries, sessionSeed]);

  useEffect(() => {
    if (allSeries.length > 0 && !feedInitRef.current) {
      feedInitRef.current = true;
      const pool = buildFeedPool(allSeries, sessionSeed);
      feedPoolRef.current = pool;
      feedOffsetRef.current = FEED_PAGE_SIZE;
      feedTotalShownRef.current = FEED_PAGE_SIZE;
      const initial = pool.slice(0, FEED_PAGE_SIZE).map((item, i) => {
        const k = `${item.series.id}::${item.episode?.id ?? "null"}`;
        shownKeysRef.current.add(k);
        return { ...item, key: `feed-${i}` };
      });
      setFeedItems(initial);
    }
  }, [allSeries, sessionSeed]);

  const handleScroll = useCallback(
    (e: any) => {
      const y = e.nativeEvent.contentOffset.y;
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;

      if (y > 80) {
        if (delta > 4 && headerVisible.current) {
          headerVisible.current = false;
          Animated.timing(headerAnim, {
            toValue: -totalHeaderH,
            useNativeDriver: true,
            duration: 250,
          }).start();
        } else if (delta < -4 && !headerVisible.current) {
          headerVisible.current = true;
          Animated.timing(headerAnim, {
            toValue: 0,
            useNativeDriver: true,
            duration: 200,
          }).start();
        }
      } else if (!headerVisible.current) {
        headerVisible.current = true;
        Animated.timing(headerAnim, {
          toValue: 0,
          useNativeDriver: true,
          duration: 200,
        }).start();
      }
    },
    [totalHeaderH]
  );

  const displayName = user?.displayName || "Friend";
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "As-salamu alaykum";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const hasMiniplayer = !!nowPlaying;

  const loadMoreFeed = useCallback(() => {
    if (loadingMoreRef.current || allSeries.length === 0) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    let pool = feedPoolRef.current;
    let offset = feedOffsetRef.current;

    // If current pool is exhausted, build a new cycle with a different seed
    if (offset >= pool.length) {
      feedCycleRef.current += 1;
      // After 2 full cycles, clear shownKeys so content can cycle around naturally
      // but still avoids immediate back-to-back duplicates within a cycle boundary
      const recentKeys = feedCycleRef.current <= 2 ? shownKeysRef.current : new Set<string>();
      const newPool = buildNextPool(feedCycleRef.current, recentKeys);
      // If filtering removed everything (very small library), just use the full shuffled pool
      feedPoolRef.current = newPool.length >= FEED_PAGE_SIZE ? newPool : buildFeedPool(allSeries, sessionSeed + feedCycleRef.current * 7919);
      feedOffsetRef.current = 0;
      // Reset shownKeys for the new cycle
      shownKeysRef.current = new Set();
      pool = feedPoolRef.current;
      offset = 0;
    }

    const nextSlice = pool.slice(offset, offset + FEED_PAGE_SIZE).map((item, i) => {
      const k = `${item.series.id}::${item.episode?.id ?? "null"}`;
      shownKeysRef.current.add(k);
      const globalIdx = feedTotalShownRef.current + i;
      return { ...item, key: `feed-${globalIdx}` };
    });

    feedOffsetRef.current = offset + FEED_PAGE_SIZE;
    feedTotalShownRef.current += nextSlice.length;
    setFeedItems((prev) => [...prev, ...nextSlice]);
    setLoadingMore(false);
    loadingMoreRef.current = false;
  }, [allSeries, buildNextPool, sessionSeed]);

  const feedRows = useMemo(() => {
    const rows: (typeof feedItems[0] | undefined)[][] = [];
    for (let i = 0; i < feedItems.length; i += 2) {
      rows.push([feedItems[i], feedItems[i + 1]]);
    }
    return rows;
  }, [feedItems]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast
        visible={referralToast.visible}
        message={`Referral code applied! +${referralToast.xp} XP bonus`}
        icon="gift"
        iconColor="#F59E0B"
        duration={3500}
        onDismiss={() => setReferralToast(prev => ({ ...prev, visible: false }))}
      />
      <Animated.View
        style={[
          styles.floatingHeader,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + (isWeb ? 67 : 0),
            borderBottomColor: colors.divider,
            transform: [{ translateY: headerAnim }],
          },
        ]}
      >
        <View style={styles.appBarBrand}>
          <View
            style={[
              styles.brandMark,
              {
                backgroundColor: colors.gold + "22",
                borderColor: colors.gold + "44",
              },
            ]}
          >
            <Icon name="moon" size={14} color={colors.goldLight} />
          </View>
          <View>
            <Text style={[styles.appTitle, { color: colors.goldLight }]}>
              StayGuided
              <Text style={{ color: colors.textPrimary }}> Me</Text>
            </Text>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              {isGuest
                ? "Welcome, Guest"
                : `${greeting()}, ${displayName}`}
            </Text>
          </View>
        </View>
        <View style={styles.appBarRight}>
          <Pressable
            onPress={() => router.push("/search")}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceHigh }]}
          >
            <Icon name="search" size={20} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/notifications")}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceHigh }]}
          >
            <Icon name="bell" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: totalHeaderH + 12,
            paddingBottom: (hasMiniplayer ? 148 : 80) + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e: any) => {
          handleScroll(e);
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 800) {
            loadMoreFeed();
          }
        }}
        onMomentumScrollEnd={(e: any) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 800) {
            loadMoreFeed();
          }
        }}
      >
        {/* Ramadan Mode Banner */}
        {settings.ramadan_mode && (
          <Pressable
            onPress={() => router.push("/quran")}
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={["#1a4a2e", "#0d2b1a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 28 }}>☪️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#d4a030", fontWeight: "700", fontSize: 15 }}>
                  Ramadan Mubarak
                </Text>
                <Text style={{ color: "#a0c8a0", fontSize: 12, marginTop: 2 }}>
                  May Allah accept your fasts and duas. Listen to Qur'an →
                </Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* Featured Banner — professional animated carousel */}
        {featured.length > 0 && (
          <View style={styles.section}>
            <FeaturedCarousel featured={featured} />
          </View>
        )}

        {/* Journey Card */}
        <AnimatedPressable onPress={() => router.push("/journey")}>
          <View
            style={[
              styles.journeyCard,
              {
                backgroundColor: colors.surfaceHigh,
                borderColor: colors.gold + "33",
              },
            ]}
          >
            <LinearGradient
              colors={[colors.gold + "22", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.journeyGrad}
            >
              <View style={styles.journeyLeft}>
                <Text
                  style={[styles.journeyLabel, { color: colors.goldLight }]}
                >
                  ✦ THE COMPLETE STORY OF ISLAM
                </Text>
                <Text
                  style={[styles.journeyTitle, { color: colors.textPrimary }]}
                >
                  Journey Through Islam
                </Text>
                <Text
                  style={[
                    styles.journeyMeta,
                    { color: colors.textSecondary },
                  ]}
                >
                  From Creation to today
                </Text>
                <View
                  style={[
                    styles.journeyProgressBg,
                    { backgroundColor: colors.divider },
                  ]}
                >
                  <View
                    style={[
                      styles.journeyProgressFill,
                      {
                        width: "5%",
                        backgroundColor: colors.gold,
                      },
                    ]}
                  />
                </View>
              </View>
              <View
                style={[
                  styles.journeyIconWrap,
                  { backgroundColor: colors.gold + "22" },
                ]}
              >
                <Icon name="map" size={28} color={colors.goldLight} />
              </View>
            </LinearGradient>
          </View>
        </AnimatedPressable>

        {/* Donation Banner */}
        {featureFlags.donation_banner && (
          <Pressable
            onPress={() => {}}
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={[colors.gold + "33", colors.gold + "11"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderWidth: 1,
                borderColor: colors.gold + "44",
                borderRadius: 14,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold + "22", alignItems: "center", justifyContent: "center" }}>
                <Icon name="heart" size={22} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.gold, fontWeight: "700", fontSize: 15 }}>
                  Support StayGuided Me
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  Help us keep Islamic content free for everyone. JazakAllah Khayran.
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.gold} />
            </LinearGradient>
          </Pressable>
        )}

        {/* Continue Listening — only shows if user has real listening history */}
        {user && continueItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text
                style={[styles.sectionTitle, { color: colors.textPrimary }]}
              >
                Continue Listening
              </Text>
            </View>
            <FlatList
              data={continueItems.slice(0, 5)}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.episodeId}
              contentContainerStyle={{ paddingLeft: 16, gap: 12 }}
              removeClippedSubviews={true}
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              windowSize={3}
              renderItem={({ item }) => {
                const series = item.seriesId
                  ? allSeries.find(s => s.id === item.seriesId)
                  : allSeries.find(s => s.episodes?.some((e: any) => e.id === item.contentId));
                return (
                <AnimatedPressable
                  onPress={() => series ? router.push(`/series/${series.id}`) : null}
                  style={[
                    styles.continueCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.continueCover,
                      { backgroundColor: series?.coverColor || colors.surfaceHigh },
                    ]}
                  >
                    {series?.coverUrl ? (
                      <FadeImage uri={series.coverUrl} style={StyleSheet.absoluteFill} />
                    ) : (
                      <Icon name="headphones" size={20} color={colors.goldLight} />
                    )}
                  </View>
                  <View style={styles.continueInfo}>
                    <Text
                      style={[
                        styles.continueName,
                        { color: colors.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.continueMeta,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {item.seriesName || series?.title || ""}
                    </Text>
                    <View
                      style={[
                        styles.continueBarBg,
                        { backgroundColor: colors.divider },
                      ]}
                    >
                      <View
                        style={[
                          styles.continueBarFill,
                          { width: "65%", backgroundColor: colors.gold },
                        ]}
                      />
                    </View>
                  </View>
                </AnimatedPressable>
                );
              }}
            />
          </View>
        )}

        {/* Popular */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              style={[styles.sectionTitle, { color: colors.textPrimary }]}
            >
              Popular
            </Text>
            <Pressable onPress={() => router.push("/popular")}>
              <Text style={[styles.seeAll, { color: colors.goldLight }]}>
                See All →
              </Text>
            </Pressable>
          </View>
          <FlatList
            data={popular}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingLeft: 16, gap: 12 }}
            removeClippedSubviews={true}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={3}
            renderItem={({ item }) => (
              <AnimatedPressable
                onPress={() => router.push(`/series/${item.id}`)}
                style={[
                  styles.popularCard,
                  { backgroundColor: item.coverColor },
                ]}
              >
                {item.coverUrl ? (
                  <FadeImage uri={item.coverUrl} style={StyleSheet.absoluteFill} />
                ) : null}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.85)"]}
                  style={styles.popularGrad}
                >
                  <View
                    style={[
                      styles.popularCatBadge,
                      { backgroundColor: "rgba(0,0,0,0.5)" },
                    ]}
                  >
                    <Text style={styles.popularCatText}>{item.category}</Text>
                  </View>
                  <Text style={styles.popularTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.popularMeta}>
                    {item.episodeCount} eps · {item.totalHours}
                  </Text>
                </LinearGradient>
              </AnimatedPressable>
            )}
          />
        </View>

        {/* New Releases */}
        {newReleases.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  New Releases
                </Text>
                <Text
                  style={[styles.sectionSub, { color: colors.textMuted }]}
                >
                  Recently added
                </Text>
              </View>
            </View>
            <FlatList
              data={newReleases}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingLeft: 16, gap: 12 }}
              removeClippedSubviews={true}
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={3}
              renderItem={({ item }) => (
                <AnimatedPressable
                  onPress={() => router.push(`/series/${item.id}`)}
                  style={[
                    styles.newReleaseCard,
                    { backgroundColor: item.coverColor },
                  ]}
                >
                  {item.coverUrl ? (
                    <FadeImage uri={item.coverUrl} style={StyleSheet.absoluteFill} />
                  ) : null}
                  <View
                    style={[styles.newBadge, { backgroundColor: colors.green }]}
                  >
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.9)"]}
                    style={styles.newReleaseGrad}
                  >
                    <Text style={styles.newReleaseTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.newReleaseMeta}>
                      <Icon
                        name="headphones"
                        size={11}
                        color="rgba(255,255,255,0.6)"
                      />
                      <Text style={styles.newReleaseMetaText}>
                        {item.episodeCount} eps
                      </Text>
                      <Text style={styles.newReleaseMetaDot}>·</Text>
                      <Text style={styles.newReleaseMetaText}>
                        {item.totalHours}
                      </Text>
                    </View>
                  </LinearGradient>
                </AnimatedPressable>
              )}
            />
          </View>
        )}

        {/* Qur'an Quick Access */}
        <AnimatedPressable onPress={() => router.push("/(tabs)/quran")}>
          <View
            style={[
              styles.quranCard,
              { backgroundColor: colors.surface, borderColor: colors.green + "55" },
            ]}
          >
            <View
              style={[
                styles.quranIconWrap,
                { backgroundColor: colors.green + "22" },
              ]}
            >
              <Icon name="book-open" size={24} color={colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.quranTitle, { color: colors.textPrimary }]}
              >
                Holy Qur'an
              </Text>
              <Text
                style={[styles.quranMeta, { color: colors.textSecondary }]}
              >
                114 Surahs · Multiple reciters · Always free
              </Text>
            </View>
            <View
              style={[
                styles.quranChevron,
                { backgroundColor: colors.green + "22" },
              ]}
            >
              <Icon name="chevron-right" size={18} color={colors.green} />
            </View>
          </View>
        </AnimatedPressable>

        {/* Hadith Quick Access */}
        <AnimatedPressable onPress={() => router.push("/hadith" as any)}>
          <View
            style={[
              styles.quranCard,
              { backgroundColor: colors.surface, borderColor: "#7c3aed55", marginTop: 10 },
            ]}
          >
            <View
              style={[
                styles.quranIconWrap,
                { backgroundColor: "#7c3aed22" },
              ]}
            >
              <Icon name="scroll" size={24} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.quranTitle, { color: colors.textPrimary }]}>
                Hadith
              </Text>
              <Text style={[styles.quranMeta, { color: colors.textSecondary }]}>
                15 Books · 57,000+ Hadiths · With translation
              </Text>
            </View>
            <View
              style={[
                styles.quranChevron,
                { backgroundColor: "#7c3aed22" },
              ]}
            >
              <Icon name="chevron-right" size={18} color="#7c3aed" />
            </View>
          </View>
        </AnimatedPressable>

        {/* Discover — 2-column grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text
                style={[styles.sectionTitle, { color: colors.textPrimary }]}
              >
                Discover
              </Text>
              <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
                {allSeries.length > 0 ? "Curated for you" : "Content loading..."}
              </Text>
            </View>
          </View>
          {feedRows.length === 0 && !contentLoading && (
            <View style={[styles.emptyFeed, { backgroundColor: colors.surface }]}>
              <Icon name="moon" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyFeedTitle, { color: colors.textPrimary }]}>
                No content yet
              </Text>
              <Text style={[styles.emptyFeedSub, { color: colors.textMuted }]}>
                Content from the admin panel will appear here once published.
              </Text>
            </View>
          )}
          {feedRows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.gridRow}>
              {row[0] && <StoryGridCard item={row[0]} />}
              {row[1] && <StoryGridCard item={row[1]} />}
            </View>
          ))}
          {loadingMore && (
            <View style={styles.loadingMore}>
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                Loading more...
              </Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0,
  },
  appBarBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  appTitle: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  greeting: {
    fontSize: 12,
    marginTop: 1,
  },
  appBarRight: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 24,
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "600",
  },
  bannerCard: {
    height: 240,
    borderRadius: 20,
    overflow: "hidden",
  },
  bannerDecorCircle: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 60,
    top: -120,
    right: -80,
  },
  bannerGrad: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 18,
    gap: 6,
  },
  bannerBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  bannerBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  bannerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bannerMeta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  bannerCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  bannerCtaText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    alignItems: "center",
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  journeyCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  journeyGrad: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },
  journeyLeft: {
    flex: 1,
    gap: 5,
  },
  journeyLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  journeyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  journeyMeta: {
    fontSize: 13,
  },
  journeyProgressBg: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
  },
  journeyProgressFill: {
    height: 4,
    borderRadius: 2,
  },
  journeyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  continueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    width: 260,
  },
  continueCover: {
    width: 50,
    height: 50,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  continueInfo: {
    flex: 1,
    gap: 3,
  },
  continueName: {
    fontSize: 14,
    fontWeight: "600",
  },
  continueMeta: {
    fontSize: 12,
  },
  continueBarBg: {
    height: 3,
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  continueBarFill: {
    height: 3,
    borderRadius: 2,
  },
  popularCard: {
    width: 160,
    height: 200,
    borderRadius: 14,
    overflow: "hidden",
  },
  popularGrad: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 12,
    gap: 4,
  },
  popularCatBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    marginBottom: 4,
  },
  popularCatText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  popularTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  popularMeta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
  },
  newReleaseCard: {
    width: 200,
    height: 130,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  newBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  newBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  newReleaseGrad: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 12,
    gap: 4,
  },
  newReleaseTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  newReleaseMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  newReleaseMetaText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
  },
  newReleaseMetaDot: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
  },
  quranCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  quranIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quranTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  quranMeta: {
    fontSize: 12,
    marginTop: 3,
  },
  quranChevron: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  gridRow: {
    flexDirection: "row",
    gap: CARD_GAP,
  },
  gridCard: {
    borderRadius: 14,
    overflow: "hidden",
  },
  gridCoverBg: {
    flex: 1,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  decorCircle1: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 40,
    top: -60,
    right: -60,
  },
  decorCircle2: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 30,
    bottom: -20,
    left: -30,
  },
  coverIcon: {
    position: "absolute",
  },
  gridBadgeWrap: {
    position: "absolute",
    top: 8,
    left: 8,
  },
  gridBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  gridBadgeText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  gridPremiumWrap: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  gridPremiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  gridPremiumText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  gridGrad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  gridPlayBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
  },
  gridInfo: {
    padding: 10,
    gap: 3,
  },
  gridEpTitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  gridSeriesName: {
    fontSize: 11,
    fontWeight: "500",
  },
  gridMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  gridDuration: { fontSize: 10 },
  gridDot: { fontSize: 10 },
  gridEpNum: { fontSize: 10 },
  loadingMore: {
    alignItems: "center",
    paddingVertical: 16,
  },
  loadingText: { fontSize: 13 },
  emptyFeed: {
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyFeedTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },
  emptyFeedSub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
});
