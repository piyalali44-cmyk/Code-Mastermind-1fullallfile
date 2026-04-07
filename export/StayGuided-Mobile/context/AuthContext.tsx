import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

import { supabase } from "@/lib/supabase";
import { applyReferralCode, ensureUserRows, fetchMyStats } from "@/lib/db";

export const PENDING_REFERRAL_KEY = "pending_referral_code";

interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  isPremium: boolean;
  xp: number;
  level: number;
  streak: number;
  longestStreak: number;
  totalHoursListened: number;
  joinDate: string;
}

export interface PendingNotification {
  type: "referral_applied";
  xp: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isGuest: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<{ userId: string | null }>;
  logout: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  hasOnboarded: boolean;
  completeOnboarding: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Immediately bump local XP by `delta` (optimistic), then sync from DB after 1.5 s. */
  applyXpBonus: (delta: number) => void;
  pendingNotification: PendingNotification | null;
  clearPendingNotification: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Builds the app User object from a Supabase session user.
// Only fetches the 3 core tables (profiles, user_xp, user_streaks) in parallel —
// listening_progress (potentially many rows) is loaded lazily by the profile screen.
async function buildUserFromSession(supabaseUser: SupabaseUser): Promise<User> {
  let displayName =
    supabaseUser.user_metadata?.display_name ??
    supabaseUser.user_metadata?.full_name ??
    supabaseUser.user_metadata?.name ??
    supabaseUser.email?.split("@")[0] ??
    "Friend";
  let isPremium = false;
  let xp = 0;
  let level = 1;
  let streak = 0;
  let longestStreak = 0;
  let joinDate = supabaseUser.created_at ?? new Date().toISOString();
  let avatarUrl: string | null =
    supabaseUser.user_metadata?.avatar_url ??
    supabaseUser.user_metadata?.picture ??
    null;
  let bio: string | null = null;
  let country: string | null = null;

  let totalHoursListened = 0;

  try {
    const [profileRes, xpRes, streakRes, historyRes, progressRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", supabaseUser.id).single(),
      supabase.from("user_xp").select("total_xp,level").eq("user_id", supabaseUser.id).single(),
      supabase.from("user_streaks").select("current_streak,longest_streak").eq("user_id", supabaseUser.id).single(),
      supabase.from("listening_history").select("duration_ms").eq("user_id", supabaseUser.id),
      supabase.from("listening_progress").select("position_ms").eq("user_id", supabaseUser.id),
    ]);

    if (!profileRes.data && !xpRes.data) {
      ensureUserRows(supabaseUser.id).catch(() => {});
    }

    if (profileRes.data) {
      displayName = profileRes.data.display_name ?? displayName;
      isPremium = profileRes.data.subscription_tier === "premium";
      joinDate = profileRes.data.joined_at ?? joinDate;
      avatarUrl = profileRes.data.avatar_url ?? avatarUrl;
      bio = profileRes.data.bio ?? null;
      country = profileRes.data.country ?? null;
    }
    if (xpRes.data) {
      xp = xpRes.data.total_xp;
      level = xpRes.data.level;
    }
    if (streakRes.data) {
      streak = streakRes.data.current_streak;
      longestStreak = streakRes.data.longest_streak ?? 0;
    }
    const histMs = (historyRes.data as any[] ?? []).reduce((sum: number, r: any) => sum + (r.duration_ms ?? 0), 0);
    if (histMs > 0) {
      totalHoursListened = Math.round((histMs / 3_600_000) * 10) / 10;
    } else if (progressRes.data && progressRes.data.length > 0) {
      const totalMs = (progressRes.data as any[]).reduce((sum, r) => sum + (r.position_ms ?? 0), 0);
      totalHoursListened = Math.round((totalMs / 3_600_000) * 10) / 10;
    }
  } catch {
    // Tables may not exist yet — use defaults
  }

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? "",
    emailVerified: !!supabaseUser.email_confirmed_at,
    displayName,
    avatarUrl,
    bio,
    country,
    isPremium,
    xp,
    level,
    streak,
    longestStreak,
    totalHoursListened,
    joinDate,
  };
}

const CACHED_USER_KEY = "cached_user_data";
const CACHED_AUTH_STATE_KEY = "cached_auth_state";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [pendingNotification, setPendingNotification] = useState<PendingNotification | null>(null);

  const clearPendingNotification = useCallback(() => setPendingNotification(null), []);

  const lastSyncRef = React.useRef<number>(0);

  const syncStatsFromApi = useCallback(async (token: string, force = false) => {
    const now = Date.now();
    if (!force && now - lastSyncRef.current < 30_000) return;
    const stats = await fetchMyStats(token);
    if (!stats) return;
    lastSyncRef.current = Date.now();
    setUser(prev => {
      if (!prev) return prev;
      const updated: typeof prev = {
        ...prev,
        xp:                 stats.xp,
        level:              stats.level,
        streak:             stats.streak,
        longestStreak:      stats.longest_streak,
        isPremium:          stats.is_premium,
        displayName:        stats.display_name  ?? prev.displayName,
        avatarUrl:          stats.avatar_url    ?? prev.avatarUrl,
        bio:                stats.bio           ?? prev.bio,
        country:            stats.country       ?? prev.country,
        joinDate:           stats.joined_at     ?? prev.joinDate,
        // Include listening time so it is cached alongside XP/streak and
        // shows instantly on next profile open — no separate DB query needed.
        totalHoursListened: stats.total_hours_listened ?? prev.totalHoursListened,
      };
      AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    // Try token from in-memory session first (avoids AsyncStorage/getSession hang).
    const token = session?.access_token;
    if (token) {
      await syncStatsFromApi(token);
      return;
    }
    // Fallback: getSession() → buildUserFromSession (legacy path for edge cases)
    const { data: { session: fresh } } = await supabase.auth.getSession();
    if (fresh?.user) {
      const u = await buildUserFromSession(fresh.user);
      setUser(u);
      AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)).catch(() => {});
    }
  }, [session, syncStatsFromApi]);

  /** Immediately apply an XP delta to local state (optimistic), then re-sync from API. */
  const applyXpBonus = useCallback((delta: number) => {
    // Step 1: instant optimistic update
    setUser(prev => {
      if (!prev) return prev;
      const newXp = prev.xp + delta;
      const updated = { ...prev, xp: newXp, level: Math.max(1, Math.floor(newXp / 500) + 1) };
      AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    // Step 2: authoritative sync from API server after 2 s
    // Uses service-role → bypasses RLS → always returns correct XP
    const token = session?.access_token;
    if (token) {
      setTimeout(() => syncStatsFromApi(token, true).catch(() => {}), 2000);
    }
  }, [session, syncStatsFromApi]);

  useEffect(() => {
    const init = async () => {
      try {
        const [onboarded, guestMode, cachedUser, cachedState] = await Promise.all([
          AsyncStorage.getItem("has_onboarded"),
          AsyncStorage.getItem("is_guest"),
          AsyncStorage.getItem(CACHED_USER_KEY),
          AsyncStorage.getItem(CACHED_AUTH_STATE_KEY),
        ]);
        setHasOnboarded(onboarded === "true");

        if (cachedUser && cachedState === "authenticated") {
          try {
            setUser(JSON.parse(cachedUser));
            setIsGuest(false);
          } catch {}
        } else if (guestMode === "true") {
          setIsGuest(true);
        }

        setIsLoading(false);

        const { data: { session: s } } = await supabase.auth.getSession();
        setSession(s);

        if (s?.user) {
          if (s.access_token) {
            await syncStatsFromApi(s.access_token, true).catch(async () => {
              // API failed — fall back to direct Supabase query
              const u = await buildUserFromSession(s.user!);
              setUser(u);
              AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)).catch(() => {});
            });
          } else {
            const u = await buildUserFromSession(s.user);
            setUser(u);
            AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)).catch(() => {});
          }
          setIsGuest(false);
          AsyncStorage.setItem(CACHED_AUTH_STATE_KEY, "authenticated").catch(() => {});
        } else {
          if (cachedState === "authenticated") {
            setUser(null);
            AsyncStorage.multiRemove([CACHED_USER_KEY, CACHED_AUTH_STATE_KEY]).catch(() => {});
          }
          if (guestMode === "true") {
            setIsGuest(true);
          }
        }
      } catch {
        setIsLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (s?.user) {
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          if (s.access_token) {
            await syncStatsFromApi(s.access_token, true).catch(async () => {
              const u = await buildUserFromSession(s.user!);
              setUser(u);
              AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)).catch(() => {});
            });
          } else {
            const u = await buildUserFromSession(s.user);
            setUser(u);
            AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)).catch(() => {});
          }
        }
        setIsGuest(false);
        await AsyncStorage.removeItem("is_guest");
        AsyncStorage.setItem(CACHED_AUTH_STATE_KEY, "authenticated").catch(() => {});

        if (event === "SIGNED_IN") {
          // Apply pending referral code in background.
          // Pass the access token directly — avoids supabase.auth.getSession() hang in RN.
          AsyncStorage.getItem(PENDING_REFERRAL_KEY).then(async (pendingCode) => {
            if (pendingCode) {
              try {
                const result = await applyReferralCode(pendingCode, s?.access_token ?? undefined);
                if (result.success) {
                  await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
                  // Show notification in home screen
                  setPendingNotification({ type: "referral_applied", xp: result.xpBonus ?? 100 });
                  // Optimistic XP update immediately
                  setUser(prev => prev ? {
                    ...prev,
                    xp:    prev.xp + (result.xpBonus ?? 100),
                    level: Math.max(1, Math.floor((prev.xp + (result.xpBonus ?? 100)) / 500) + 1),
                  } : prev);
                  // Authoritative sync via API server after 1.5 s
                  if (s?.access_token) {
                    setTimeout(() => syncStatsFromApi(s.access_token).catch(() => {}), 1500);
                  }
                } else if (result.error === "already_used" || result.error === "own_code") {
                  await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
                }
              } catch { /* fail silently */ }
            }
          }).catch(() => {});

          // Register push token in background
          import("@/lib/notifications").then(({ registerPushToken }) => {
            registerPushToken(s.user.id).catch(() => {});
          });
        }
      } else {
        setUser(null);
      }
    });

    const appStateListener = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (s?.access_token) {
            syncStatsFromApi(s.access_token).catch(() => {});
          }
        }).catch(() => {});
      }
    });

    return () => {
      subscription.unsubscribe();
      appStateListener.remove();
    };
  }, []);

  // ── Real-time: direct state updates (no DB round-trip) ───────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;
          setUser(prev => prev ? {
            ...prev,
            displayName: row.display_name   ?? prev.displayName,
            isPremium:   row.subscription_tier === "premium",
            avatarUrl:   row.avatar_url     ?? prev.avatarUrl,
            bio:         row.bio            ?? prev.bio,
            country:     row.country        ?? prev.country,
          } : prev);
          // Keep cache in sync
          setUser(u => {
            if (u) AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)).catch(() => {});
            return u;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_xp", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;
          setUser(prev => prev ? {
            ...prev,
            xp:    row.total_xp ?? prev.xp,
            level: row.level    ?? prev.level,
          } : prev);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_streaks", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;
          setUser(prev => prev ? {
            ...prev,
            streak:        row.current_streak  ?? prev.streak,
            longestStreak: row.longest_streak  ?? prev.longestStreak,
          } : prev);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // ── Shared helper: build prelim user from server JSON ───────────────────────
  const buildPrelimUser = useCallback((userData: any, emailFallback: string): User => {
    const meta = userData?.user_metadata ?? {};
    return {
      id:                 userData?.id ?? "",
      email:              userData?.email ?? emailFallback,
      emailVerified:      !!userData?.email_confirmed_at,
      displayName:        meta?.display_name ?? meta?.full_name ?? meta?.name
                          ?? emailFallback.split("@")[0] ?? "Friend",
      avatarUrl:          meta?.avatar_url ?? meta?.picture ?? null,
      bio:                null,
      country:            null,
      isPremium:          false,
      xp:                 0,
      level:              1,
      streak:             0,
      longestStreak:      0,
      totalHoursListened: 0,
      joinDate:           userData?.created_at ?? new Date().toISOString(),
    };
  }, []);

  // ── Fire-and-forget setSession (triggers onAuthStateChange in background) ──
  const applyTokens = useCallback((accessToken: string, refreshToken: string) => {
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .catch(() => {}); // Never block — onAuthStateChange will update state when ready
  }, []);

  const _authDomain = process.env.EXPO_PUBLIC_DOMAIN || "";
  const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL
    ?? (_authDomain ? `https://${_authDomain}/api` : "http://localhost:8080/api");

  const login = useCallback(async (email: string, password: string) => {
    // Route through API server so the Supabase auth call happens server-side.
    // This prevents the browser from making a slow/blocked direct call to Supabase Auth.
    const res = await fetch(`${API_BASE}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Login failed");

    // Immediately set user state — use real XP/streak from server response (no delay).
    const prelimUser = buildPrelimUser(json.user, email);
    const readyUser = {
      ...prelimUser,
      xp:     typeof json.xp     === "number" ? json.xp     : 0,
      level:  typeof json.level  === "number" ? json.level  : 1,
      streak: typeof json.streak === "number" ? json.streak : 0,
    };
    setUser(readyUser);
    setIsGuest(false);
    AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(readyUser)).catch(() => {});
    AsyncStorage.setItem(CACHED_AUTH_STATE_KEY, "authenticated").catch(() => {});

    // Set session in background → triggers onAuthStateChange → refreshes with full DB data
    if (json.access_token && json.refresh_token) {
      applyTokens(json.access_token, json.refresh_token);
    }
  }, [API_BASE, buildPrelimUser, applyTokens]);

  const signup = useCallback(async (
    email: string,
    password: string,
    name: string,
  ): Promise<{ userId: string | null }> => {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Signup failed");

    const userId: string | null = json.userId ?? null;

    // Pre-populate user state immediately — tabs render with real name right away.
    const prelimUser: User = {
      id:               userId ?? "",
      email:            email.trim(),
      emailVerified:    true,
      displayName:      name.trim(),
      avatarUrl:        null,
      bio:              null,
      country:          null,
      isPremium:        false,
      xp:               0,
      level:            1,
      streak:           0,
      longestStreak:    0,
      totalHoursListened: 0,
      joinDate:         new Date().toISOString(),
    };
    setUser(prelimUser);
    setIsGuest(false);
    AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(prelimUser)).catch(() => {});
    AsyncStorage.setItem(CACHED_AUTH_STATE_KEY, "authenticated").catch(() => {});

    // Set session in background — never await, so signup() returns instantly.
    // onAuthStateChange fires when setSession resolves and updates with full DB data.
    if (json.access_token && json.refresh_token) {
      applyTokens(json.access_token, json.refresh_token);
    }

    return { userId };
  }, [API_BASE, applyTokens]);

  const logout = useCallback(async () => {
    setUser(null);
    setIsGuest(false);
    setSession(null);
    await AsyncStorage.multiRemove(["is_guest", "user_country_pending", CACHED_USER_KEY, CACHED_AUTH_STATE_KEY]).catch(() => {});
    await supabase.auth.signOut().catch(() => {});
  }, []);

  const continueAsGuest = useCallback(async () => {
    setIsGuest(true);
    setUser(null);
    await AsyncStorage.setItem("is_guest", "true");
  }, []);

  const completeOnboarding = useCallback(async () => {
    setHasOnboarded(true);
    await AsyncStorage.setItem("has_onboarded", "true");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user, session, isGuest, isLoading,
        login, signup,
        logout, continueAsGuest,
        hasOnboarded, completeOnboarding, refreshUser, applyXpBonus,
        pendingNotification, clearPendingNotification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
