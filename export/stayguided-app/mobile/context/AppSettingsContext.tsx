import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export interface AppSettings {
  maintenance_mode: boolean;
  guest_access_enabled: boolean;
  weekly_price_usd: string;
  monthly_price_usd: string;
  trial_enabled: boolean;
  trial_days: number;
  subscription_enabled: boolean;
  ramadan_mode: boolean;
  app_name: string;
}

export interface FeatureFlags {
  social_sharing: boolean;
  quran_word_by_word: boolean;
  quiz_mode: boolean;
  journey_mode: boolean;
  referral_program: boolean;
  referral_system: boolean;
  leaderboard: boolean;
  streak_notifications: boolean;
  streak_tracking: boolean;
  offline_downloads: boolean;
  dark_mode_toggle: boolean;
  push_notifications: boolean;
  donation_banner: boolean;
  in_app_purchases: boolean;
  quran_player: boolean;
  prayer_times: boolean;
  bookmarks: boolean;
  guest_mode: boolean;
  playback_speed: boolean;
  analytics_events: boolean;
  rate_app: boolean;
  [key: string]: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  maintenance_mode: false,
  guest_access_enabled: true,
  weekly_price_usd: "0.99",
  monthly_price_usd: "4.99",
  trial_enabled: false,
  trial_days: 7,
  subscription_enabled: true,
  ramadan_mode: false,
  app_name: "StayGuided Me",
};

const DEFAULT_FLAGS: FeatureFlags = {
  social_sharing: true,
  quran_word_by_word: false,
  quiz_mode: false,
  journey_mode: true,
  referral_program: true,
  referral_system: true,
  leaderboard: true,
  streak_notifications: true,
  streak_tracking: true,
  offline_downloads: true,
  dark_mode_toggle: false,
  push_notifications: true,
  donation_banner: false,
  in_app_purchases: false,
  quran_player: true,
  prayer_times: true,
  bookmarks: true,
  guest_mode: true,
  playback_speed: true,
  analytics_events: true,
  rate_app: true,
};

export interface PopupNotice {
  id: string;
  title: string;
  body: string | null;
  type: string;
  cta_label: string | null;
  cta_url: string | null;
  is_active: boolean;
  target_audience: string;
  starts_at: string | null;
  ends_at: string | null;
}

const DISMISSED_POPUPS_KEY = "dismissed_popup_ids";
const NOTIFIED_POPUPS_KEY = "notified_popup_ids";

const SETTINGS_KEYS = [
  "maintenance_mode",
  "guest_access_enabled",
  "weekly_price_usd",
  "monthly_price_usd",
  "trial_enabled",
  "trial_days",
  "subscription_enabled",
  "ramadan_mode",
  "app_name",
];

interface AppSettingsContextType {
  settings: AppSettings;
  featureFlags: FeatureFlags;
  popupNotices: PopupNotice[];
  dismissPopup: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextType>({
  settings: DEFAULT_SETTINGS,
  featureFlags: DEFAULT_FLAGS,
  popupNotices: [],
  dismissPopup: () => {},
  loading: true,
  refresh: async () => {},
});

const SETTINGS_CACHE_KEY = "cached_app_settings";
const FLAGS_CACHE_KEY = "cached_feature_flags";

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [popupNotices, setPopupNotices] = useState<PopupNotice[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(DISMISSED_POPUPS_KEY),
      AsyncStorage.getItem(NOTIFIED_POPUPS_KEY),
      AsyncStorage.getItem(SETTINGS_CACHE_KEY),
      AsyncStorage.getItem(FLAGS_CACHE_KEY),
    ]).then(([dismissed, notified, cachedSettings, cachedFlags]) => {
      if (dismissed) try { setDismissedIds(new Set(JSON.parse(dismissed))); } catch {}
      if (notified) try { notifiedIdsRef.current = new Set(JSON.parse(notified)); } catch {}
      if (cachedSettings) {
        try { setSettings(JSON.parse(cachedSettings)); } catch {}
      }
      if (cachedFlags) {
        try { setFeatureFlags(JSON.parse(cachedFlags)); } catch {}
      }
    }).catch(() => {});
  }, []);

  const dismissPopup = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem(DISMISSED_POPUPS_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
    setPopupNotices((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const [settingsRes, flagsRes, popupsRes] = await Promise.all([
        supabase.from("app_settings").select("key,value").in("key", SETTINGS_KEYS),
        supabase.from("feature_flags").select("key,is_enabled"),
        supabase
          .from("popup_notices")
          .select("id,title,body,type,cta_label,cta_url,is_active,target_audience,starts_at,ends_at")
          .eq("is_active", true)
          .or(`starts_at.is.null,starts_at.lte.${now}`)
          .or(`ends_at.is.null,ends_at.gte.${now}`)
          .order("created_at", { ascending: false }),
      ]);

      if (settingsRes.data && settingsRes.data.length > 0) {
        const map: Record<string, string> = {};
        settingsRes.data.forEach((r: { key: string; value: unknown }) => {
          const v = r.value;
          map[r.key] = typeof v === "string" ? v.replace(/^"|"$/g, "") : String(v ?? "");
        });
        const newSettings: AppSettings = {
          maintenance_mode: map["maintenance_mode"] === "true",
          guest_access_enabled: map["guest_access_enabled"] !== "false",
          weekly_price_usd: map["weekly_price_usd"] || DEFAULT_SETTINGS.weekly_price_usd,
          monthly_price_usd: map["monthly_price_usd"] || DEFAULT_SETTINGS.monthly_price_usd,
          trial_enabled: map["trial_enabled"] === "true",
          trial_days: parseInt(map["trial_days"] || "7", 10) || 7,
          subscription_enabled: map["subscription_enabled"] !== "false",
          ramadan_mode: map["ramadan_mode"] === "true",
          app_name: map["app_name"] || DEFAULT_SETTINGS.app_name,
        };
        setSettings(newSettings);
        AsyncStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(newSettings)).catch(() => {});
      }

      if (flagsRes.data && flagsRes.data.length > 0) {
        const flagMap: Record<string, boolean> = { ...DEFAULT_FLAGS };
        flagsRes.data.forEach((r: { key: string; is_enabled: boolean }) => {
          flagMap[r.key] = r.is_enabled;
        });
        setFeatureFlags(flagMap as FeatureFlags);
        AsyncStorage.setItem(FLAGS_CACHE_KEY, JSON.stringify(flagMap)).catch(() => {});
      }

      if (popupsRes.data) {
        const activeNotices = (popupsRes.data as PopupNotice[]).filter((p) => !dismissedIds.has(p.id));
        setPopupNotices(activeNotices);

        const newNotices = activeNotices.filter((p) => !notifiedIdsRef.current.has(p.id));
        if (newNotices.length > 0) {
          for (const notice of newNotices) {
            notifiedIdsRef.current.add(notice.id);
            import("@/lib/notifications").then(({ scheduleLocalNotification }) =>
              scheduleLocalNotification(notice.title, notice.body, "/contact")
            ).catch(() => {});
          }
          AsyncStorage.setItem(NOTIFIED_POPUPS_KEY, JSON.stringify([...notifiedIdsRef.current])).catch(() => {});
        }
      }
    } catch (err) {
      console.warn("AppSettings fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [dismissedIds]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const settingsChannel = supabase
      .channel("app-settings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => {
        fetchAll();
      })
      .subscribe();

    const flagsChannel = supabase
      .channel("feature-flags-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_flags" }, () => {
        fetchAll();
      })
      .subscribe();

    const popupsChannel = supabase
      .channel("popup-notices-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "popup_notices" }, () => {
        fetchAll();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(flagsChannel);
      supabase.removeChannel(popupsChannel);
    };
  }, [fetchAll]);

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active") fetchAll();
    };
    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [fetchAll]);

  useEffect(() => {
    const interval = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return (
    <AppSettingsContext.Provider value={{ settings, featureFlags, popupNotices, dismissPopup, loading, refresh: fetchAll }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
