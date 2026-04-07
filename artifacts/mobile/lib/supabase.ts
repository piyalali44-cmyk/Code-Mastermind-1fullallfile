import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// ── Supabase configuration ──────────────────────────────────────────────────
// URL falls back to the hardcoded project URL if env var is not set.
// The anon key must be provided via EXPO_PUBLIC_SUPABASE_ANON_KEY.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://tkruzfskhtcazjxdracm.supabase.co";

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "";

// Exported so screens can show a friendly "misconfigured" state rather than
// crashing with cryptic network errors.
export const SUPABASE_KEY_MISSING = !supabaseAnonKey;

if (__DEV__ && SUPABASE_KEY_MISSING) {
  console.warn(
    "[supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY is not set — all Supabase " +
      "requests will fail. Set the key in your environment variables.",
  );
}

// ── Client singleton ────────────────────────────────────────────────────────
// We intentionally do NOT fall back to a placeholder JWT. Using an invalid
// key causes silent auth failures that are hard to debug. Instead, callers
// should guard on SUPABASE_KEY_MISSING before making requests.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
  global: {
    headers: {
      "x-app-name": "StayGuided Me",
    },
  },
});

// ── Type helpers ────────────────────────────────────────────────────────────
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          joined_at: string;
          subscription_tier: "free" | "premium";
          subscription_expires_at: string | null;
          is_active: boolean;
          updated_at: string;
        };
      };
      user_settings: {
        Row: {
          user_id: string;
          quran_reciter: string;
          quran_translation_edition: string;
          quran_show_arabic: boolean;
          quran_show_translation: boolean;
          autoplay: boolean;
          background_play: boolean;
          download_wifi_only: boolean;
          notifications_enabled: boolean;
          streak_reminder: boolean;
          updated_at: string;
        };
      };
      user_xp: {
        Row: {
          user_id: string;
          total_xp: number;
          level: number;
          updated_at: string;
        };
      };
      user_streaks: {
        Row: {
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_activity_date: string | null;
          updated_at: string;
        };
      };
      listening_progress: {
        Row: {
          user_id: string;
          content_type: "surah" | "episode";
          content_id: string;
          position_ms: number;
          duration_ms: number;
          completed: boolean;
          updated_at: string;
        };
      };
      favourites: {
        Row: {
          id: string;
          user_id: string;
          content_type: "surah" | "episode" | "series";
          content_id: string;
          title: string;
          series_name: string | null;
          cover_color: string | null;
          created_at: string;
        };
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          content_type: "surah" | "episode" | "series";
          content_id: string;
          title: string;
          series_name: string | null;
          cover_color: string | null;
          created_at: string;
        };
      };
      downloads: {
        Row: {
          id: string;
          user_id: string;
          content_type: "surah" | "episode";
          content_id: string;
          title: string;
          file_size_bytes: number | null;
          downloaded_at: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: "weekly" | "monthly";
          status: "active" | "cancelled" | "expired" | "trial";
          started_at: string;
          expires_at: string | null;
          provider: string;
          provider_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};
