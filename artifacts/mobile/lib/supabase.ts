import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://tkruzfskhtcazjxdracm.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

export const SUPABASE_KEY_MISSING = !supabaseAnonKey;

const PLACEHOLDER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

export const supabase = createClient(supabaseUrl, supabaseAnonKey || PLACEHOLDER_KEY, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

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
        Row: { user_id: string; total_xp: number; level: number; updated_at: string };
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
