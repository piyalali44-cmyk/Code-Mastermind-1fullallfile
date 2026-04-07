import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { Episode, Series } from "@/data/mockData";
import { MOCK_SERIES } from "@/data/mockData";

const CONTENT_CACHE_KEY = "cached_content_series";

const COVER_COLORS = [
  "#1a3a5c", "#2d1b4e", "#1b3d2f", "#4a2c17", "#1e3a3a",
  "#3a1a2e", "#2c3e50", "#1a472a", "#4a1a1a", "#1a2744",
  "#3d2b1f", "#1a3333", "#2e1a3a", "#1a4a3a", "#3a2d1a",
];

function formatDuration(secs: number): string {
  if (secs <= 0) return "0 min";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
  return `${m} min`;
}

function formatTotalHours(secs: number): string {
  if (secs <= 0) return "0 hrs";
  const h = Math.round(secs / 3600 * 10) / 10;
  if (h < 1) return `${Math.round(secs / 60)} min`;
  return `${h} hrs`;
}

interface ContentContextType {
  series: Series[];
  loading: boolean;
  refresh: () => Promise<void>;
  getSeriesById: (id: string) => Series | undefined;
}

const ContentContext = createContext<ContentContextType>({
  series: [],
  loading: true,
  refresh: async () => {},
  getSeriesById: () => undefined,
});

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const cacheLoaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(CONTENT_CACHE_KEY).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSeries(parsed);
            setLoading(false);
          }
        } catch {}
      }
      cacheLoaded.current = true;
    }).catch(() => { cacheLoaded.current = true; });
  }, []);

  const fetchContent = useCallback(async () => {
    try {
      // Fetch all published series
      const { data: seriesData, error: seriesErr } = await supabase
        .from("series")
        .select("*, category:categories(id,name)")
        .eq("pub_status", "published")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (seriesErr) {
        console.error("ContentContext: series fetch error →", seriesErr.message, seriesErr.code);
        // Only fall back to mock data on genuine network/auth errors
        if (!seriesErr.message.includes("permission") && !seriesErr.message.includes("policy")) {
          setSeries(MOCK_SERIES);
        } else {
          // Policy error — DB accessible but no read policy; show empty
          setSeries([]);
        }
        setLoading(false);
        return;
      }

      // If DB has no published series yet, show empty (don't use mock)
      if (!seriesData || seriesData.length === 0) {
        console.warn("ContentContext: no published series found in DB");
        setSeries([]);
        setLoading(false);
        return;
      }

      const seriesIds = seriesData.map((s: any) => s.id);

      // Fetch ALL episodes belonging to published series (no pub_status filter — RLS handles visibility)
      // This ensures admin-added episodes (draft or published) all appear when the parent series is published
      const { data: episodesData, error: episodesErr } = await supabase
        .from("episodes")
        .select("id, series_id, episode_number, title, description, short_summary, duration, audio_url, is_premium, pub_status, cover_override_url")
        .in("series_id", seriesIds)
        .order("episode_number");

      if (episodesErr) {
        console.warn("ContentContext: episodes fetch error →", episodesErr.message);
      }

      const episodesBySeries: Record<string, any[]> = {};
      (episodesData || []).forEach((ep: any) => {
        if (!episodesBySeries[ep.series_id]) episodesBySeries[ep.series_id] = [];
        episodesBySeries[ep.series_id].push(ep);
      });

      const mapped: Series[] = seriesData.map((s: any, idx: number) => {
        const eps = episodesBySeries[s.id] || [];

        // Calculate from actual fetched episodes
        const actualCount = eps.length;
        const calculatedDuration = eps.reduce((sum: number, ep: any) => sum + (ep.duration || 0), 0);

        // episodeCount ALWAYS matches series.episodes.length for consistency
        // totalHours uses DB fallback only if no episodes fetched (series with no episodes yet)
        const displayDuration = calculatedDuration > 0 ? calculatedDuration : (s.total_duration || 0);

        return {
          id: s.id,
          title: s.title || "",
          description: s.description || s.short_summary || "",
          coverColor: s.cover_color || COVER_COLORS[idx % COVER_COLORS.length],
          coverUrl: s.cover_url || "",
          category: s.category?.name || s.category_name || "General",
          episodeCount: actualCount,
          totalHours: formatTotalHours(displayDuration),
          isFeatured: s.is_featured || false,
          isNew: s.is_new || (s.created_at
            ? (Date.now() - new Date(s.created_at).getTime()) < 30 * 24 * 60 * 60 * 1000
            : false),
          playCount: s.play_count || 0,
          episodes: eps.map((ep: any) => ({
            id: ep.id,
            number: ep.episode_number || 1,
            title: ep.title || "",
            description: ep.short_summary || ep.description || "",
            duration: formatDuration(ep.duration || 0),
            durationSecs: ep.duration || 0,
            isPremium: ep.is_premium || false,
            progress: 0,
            audioUrl: ep.audio_url || "",
            hasAudio: !!ep.audio_url,
            coverUrl: ep.cover_override_url || "",
          })),
        };
      });

      // Prefetch all cover images in background for instant display
      const imageUrls = mapped
        .map((s) => s.coverUrl)
        .filter(Boolean) as string[];
      imageUrls.forEach((url) => {
        if (url) Image.prefetch(url).catch(() => {});
      });

      setSeries(mapped);
      AsyncStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(mapped)).catch(() => {});
    } catch (err) {
      console.error("ContentContext: unexpected error →", err);
      setSeries(MOCK_SERIES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  useEffect(() => {
    const channel = supabase
      .channel("content-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "series" }, () => { fetchContent(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "episodes" }, () => { fetchContent(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchContent]);

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active") fetchContent();
    };
    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [fetchContent]);

  const getSeriesById = useCallback((id: string) => {
    return series.find(s => s.id === id);
  }, [series]);

  return (
    <ContentContext.Provider value={{ series, loading, refresh: fetchContent, getSeriesById }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  return useContext(ContentContext);
}
