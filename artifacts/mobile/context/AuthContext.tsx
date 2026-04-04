import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { applyReferralCode, ensureUserRows } from "@/lib/db";

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
}

const AuthContext = createContext<AuthContextType | null>(null);

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
    const [profileRes, xpRes, streakRes, progressRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", supabaseUser.id).single(),
      supabase.from("user_xp").select("*").eq("user_id", supabaseUser.id).single(),
      supabase.from("user_streaks").select("*").eq("user_id", supabaseUser.id).single(),
      supabase.from("listening_progress").select("position_ms").eq("user_id", supabaseUser.id),
    ]);

    if (!profileRes.data || !xpRes.data || !streakRes.data) {
      await ensureUserRows(supabaseUser.id);
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
    if (progressRes.data) {
      const totalMs = progressRes.data.reduce((sum, r: any) => sum + (r.position_ms ?? 0), 0);
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

  const refreshUser = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user) {
      const u = await buildUserFromSession(s.user);
      setUser(u);
      AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)).catch(() => {});
    }
  }, []);

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
          const u = await buildUserFromSession(s.user);
          setUser(u);
          setIsGuest(false);
          AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)).catch(() => {});
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
        const u = await buildUserFromSession(s.user);
        setUser(u);
        setIsGuest(false);
        await AsyncStorage.removeItem("is_guest");
        AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)).catch(() => {});
        AsyncStorage.setItem(CACHED_AUTH_STATE_KEY, "authenticated").catch(() => {});
        if (event === "SIGNED_IN") {
          AsyncStorage.getItem(PENDING_REFERRAL_KEY).then(async (pendingCode) => {
            if (pendingCode) {
              try {
                const result = await applyReferralCode(pendingCode);
                if (result.success || result.error === "already_used") {
                  await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
                }
              } catch { /* fail silently */ }
            }
          }).catch(() => {});
        }
        if (event === "SIGNED_IN") {
          import("@/lib/notifications").then(({ registerPushToken }) => {
            registerPushToken(s.user.id).catch(() => {});
          });
        }
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => { refreshUser(); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_xp", filter: `user_id=eq.${user.id}` },
        () => { refreshUser(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string): Promise<{ userId: string | null }> => {
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL
      || "https://2c674757-24e6-4f77-a319-e136047f4e8f-00-319jytwvw59q6.pike.replit.dev/api";
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Signup failed");
    const userId: string | null = json.userId ?? null;
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) throw new Error(signInError.message);
    return { userId };
  }, []);

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
        hasOnboarded, completeOnboarding, refreshUser,
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
