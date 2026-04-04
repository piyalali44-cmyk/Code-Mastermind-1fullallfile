// @refresh reset
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AdminRole, Profile } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AdminRole | null;
  loading: boolean;
  accessDenied: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAtLeast: (minRole: AdminRole) => boolean;
}

const ROLE_RANK: Record<AdminRole, number> = {
  super_admin: 5,
  admin: 4,
  editor: 3,
  content: 2,
  support: 1,
};

const ADMIN_ROLES = new Set<string>(["super_admin", "admin", "editor", "content", "support"]);

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const signInInProgress = useRef(false);

  async function fetchProfile(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error || !data) return null;
      if (!ADMIN_ROLES.has(data.role ?? "")) return null;
      return data as Profile;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 10_000);

    supabase.auth.getSession().then(async ({ data: { session: s }, error }) => {
      if (cancelled) return;

      if (error && /refresh_token|session_not_found/i.test(error.message)) {
        await supabase.auth.signOut().then(() => {}, () => {});
        setUser(null);
        setSession(null);
        setProfile(null);
        setLoading(false);
        clearTimeout(timeout);
        return;
      }

      if (s?.user) {
        setSession(s);
        setUser(s.user);
        const p = await fetchProfile(s.user.id);
        if (!cancelled) {
          if (p) {
            setProfile(p);
          } else {
            setAccessDenied(true);
            await supabase.auth.signOut().then(() => {}, () => {});
            setUser(null);
            setSession(null);
          }
        }
      }

      if (!cancelled) setLoading(false);
      clearTimeout(timeout);
    }).catch(async () => {
      if (cancelled) return;
      await supabase.auth.signOut().then(() => {}, () => {});
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      clearTimeout(timeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (cancelled) return;
        if (signInInProgress.current) return;

        if (event === "TOKEN_REFRESHED" && !s) {
          await supabase.auth.signOut().then(() => {}, () => {});
          setUser(null);
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
          setProfile(null);
          setAccessDenied(false);
          setLoading(false);
          return;
        }

        if (s?.user && event === "SIGNED_IN") {
          setSession(s);
          setUser(s.user);
        }
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    signInInProgress.current = true;
    setAccessDenied(false);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        signInInProgress.current = false;
        return { error: error.message };
      }

      const authUser = data.user;
      const authSession = data.session;
      if (!authUser || !authSession) {
        setLoading(false);
        signInInProgress.current = false;
        return { error: "Authentication failed. Please try again." };
      }

      setUser(authUser);
      setSession(authSession);

      const p = await fetchProfile(authUser.id);
      if (!p) {
        setAccessDenied(true);
        setUser(null);
        setSession(null);
        await supabase.auth.signOut().then(() => {}, () => {});
        setLoading(false);
        signInInProgress.current = false;
        return { error: "No admin profile found for this account." };
      }

      setProfile(p);
      setLoading(false);
      signInInProgress.current = false;
      return { error: null };
    } catch {
      setLoading(false);
      signInInProgress.current = false;
      return { error: "An unexpected error occurred. Please try again." };
    }
  }

  async function signOut() {
    await supabase.auth.signOut().then(() => {}, () => {});
    setProfile(null);
    setUser(null);
    setSession(null);
    setAccessDenied(false);
  }

  const role = profile?.role ?? null;

  function isAtLeast(minRole: AdminRole): boolean {
    if (!role) return false;
    return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[minRole] ?? 99);
  }

  return (
    <AuthContext.Provider
      value={{ user, session, profile, role, loading, accessDenied, signIn, signOut, isAtLeast }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
