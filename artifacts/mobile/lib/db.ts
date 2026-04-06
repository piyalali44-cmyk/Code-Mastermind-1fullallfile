import { supabase } from "./supabase";

// ─── ENSURE USER ROWS EXIST (for users created before the trigger) ───────────
export async function ensureUserRows(userId: string) {
  try {
    const results = await Promise.all([
      supabase.from("user_xp").upsert(
        { user_id: userId },
        { onConflict: "user_id", ignoreDuplicates: true }
      ),
      supabase.from("user_streaks").upsert(
        { user_id: userId },
        { onConflict: "user_id", ignoreDuplicates: true }
      ),
      supabase.from("user_settings").upsert(
        { user_id: userId },
        { onConflict: "user_id", ignoreDuplicates: true }
      ),
    ]);
    results.forEach((r, i) => { if (r.error) console.warn(`[ensureUserRows] op${i}`, r.error.message); });
  } catch (err) { console.warn("[ensureUserRows]", err); }
}

// ─── XP ──────────────────────────────────────────────────────────────────────
export async function addXp(userId: string, amount: number, reason: string) {
  try {
    const { error: e1 } = await supabase.from("user_xp").upsert(
      { user_id: userId, total_xp: 0, level: 1 },
      { onConflict: "user_id", ignoreDuplicates: true }
    );
    if (e1) console.warn("[addXp] ensure row", e1.message);
    const { error: e2 } = await supabase.from("daily_xp_log").insert({ user_id: userId, xp_amount: amount, reason });
    if (e2) console.warn("[addXp] log", e2.message);
    const { data: existing } = await supabase
      .from("user_xp")
      .select("total_xp")
      .eq("user_id", userId)
      .single();
    const currentXp = existing?.total_xp ?? 0;
    const newXp = currentXp + amount;
    const newLevel = Math.floor(newXp / 500) + 1;
    const { error: e3 } = await supabase.from("user_xp").upsert(
      { user_id: userId, total_xp: newXp, level: newLevel, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (e3) console.warn("[addXp] upsert", e3.message);
  } catch (err) { console.warn("[addXp]", err); }
}

// ─── STREAKS ─────────────────────────────────────────────────────────────────
export async function updateStreak(userId: string) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from("user_streaks").select("*").eq("user_id", userId).single();
    if (!data) {
      // Create streak row for users who signed up before the trigger
      const { error: e1 } = await supabase.from("user_streaks").upsert(
        { user_id: userId, current_streak: 1, longest_streak: 1, last_activity_date: today },
        { onConflict: "user_id" }
      );
      if (e1) console.warn("[updateStreak] upsert", e1.message);
      return;
    }
    const last = data.last_activity_date;
    if (last === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = last === yesterday ? data.current_streak + 1 : 1;
    const longest = Math.max(newStreak, data.longest_streak ?? 0);
    const { error: e2 } = await supabase.from("user_streaks").update({
      current_streak: newStreak,
      longest_streak: longest,
      last_activity_date: today,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    if (e2) console.warn("[updateStreak] update", e2.message);
  } catch (err) { console.warn("[updateStreak]", err); }
}

// ─── LISTENING PROGRESS ───────────────────────────────────────────────────────
export async function saveProgress(userId: string, contentType: "surah" | "episode", contentId: string, positionMs: number, durationMs: number) {
  try {
    const completed = durationMs > 0 && positionMs / durationMs > 0.9;
    const { error } = await supabase.from("listening_progress").upsert({
      user_id: userId,
      content_type: contentType,
      content_id: contentId,
      position_ms: positionMs,
      duration_ms: durationMs,
      completed,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,content_type,content_id" });
    if (error) console.warn("[saveProgress]", error.message);
  } catch (err) { console.warn("[saveProgress]", err); }
}

export async function getProgress(userId: string, contentType: "surah" | "episode", contentId: string) {
  try {
    const { data } = await supabase.from("listening_progress").select("position_ms, duration_ms, completed").eq("user_id", userId).eq("content_type", contentType).eq("content_id", contentId).single();
    return data;
  } catch { return null; }
}

// ─── HISTORY ─────────────────────────────────────────────────────────────────
export async function addToHistory(userId: string, entry: { contentType: "surah" | "episode"; contentId: string; title: string; seriesName?: string; seriesId?: string; durationMs?: number }): Promise<string | null> {
  try {
    const { data, error } = await supabase.from("listening_history").insert({
      user_id: userId,
      content_type: entry.contentType,
      content_id: entry.contentId,
      title: entry.title,
      series_name: entry.seriesName ?? null,
      series_id: entry.seriesId ?? null,
      duration_ms: entry.durationMs ?? 0,
    }).select("id").single();
    if (error) console.warn("[addToHistory]", error.message);
    return data?.id ?? null;
  } catch (err) { console.warn("[addToHistory]", err); return null; }
}

export async function updateHistoryDuration(historyId: string, durationMs: number): Promise<void> {
  if (!historyId || durationMs <= 0) return;
  try {
    const { error } = await supabase.from("listening_history").update({ duration_ms: durationMs }).eq("id", historyId);
    if (error) console.warn("[updateHistoryDuration]", error.message);
  } catch (err) { console.warn("[updateHistoryDuration]", err); }
}

export interface RecentlyPlayedItem {
  contentType: string;
  contentId: string;
  title: string;
  seriesName?: string;
  seriesId?: string;
  durationMs: number;
  listenedAt: string;
}

export async function getRecentlyPlayed(userId: string, limit = 20): Promise<RecentlyPlayedItem[]> {
  try {
    const { data, error } = await supabase
      .from("listening_history")
      .select("content_type, content_id, title, series_name, series_id, duration_ms, listened_at")
      .eq("user_id", userId)
      .order("listened_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const seen = new Set<string>();
    return (data ?? [])
      .filter((r: any) => {
        const key = r.series_id ?? r.content_id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r: any) => ({
        contentType: r.content_type,
        contentId: r.content_id,
        title: r.title,
        seriesName: r.series_name ?? undefined,
        seriesId: r.series_id ?? undefined,
        durationMs: r.duration_ms ?? 0,
        listenedAt: r.listened_at,
      }));
  } catch { return []; }
}

export async function getListeningHistory(userId: string, limit = 30): Promise<RecentlyPlayedItem[]> {
  try {
    const { data, error } = await supabase
      .from("listening_history")
      .select("content_type, content_id, title, series_name, series_id, duration_ms, listened_at")
      .eq("user_id", userId)
      .order("listened_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      contentType: r.content_type,
      contentId: r.content_id,
      title: r.title,
      seriesName: r.series_name ?? undefined,
      seriesId: r.series_id ?? undefined,
      durationMs: r.duration_ms ?? 0,
      listenedAt: r.listened_at,
    }));
  } catch { return []; }
}

export interface CompletedItem {
  contentType: string;
  contentId: string;
  title: string;
  seriesName?: string;
  seriesId?: string;
  durationMs: number;
  completedAt: string;
}

export async function getCompletedContent(userId: string): Promise<CompletedItem[]> {
  try {
    // Get completed items from listening_progress, enriched with title from latest history entry
    const { data: progressData, error: progressErr } = await supabase
      .from("listening_progress")
      .select("content_type, content_id, duration_ms, updated_at")
      .eq("user_id", userId)
      .eq("completed", true)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (progressErr) throw progressErr;
    if (!progressData || progressData.length === 0) return [];

    // For each completed item, fetch the most recent title from listening_history
    const results: CompletedItem[] = await Promise.all(
      (progressData as any[]).map(async (p) => {
        const { data: histRow } = await supabase
          .from("listening_history")
          .select("title, series_name, series_id")
          .eq("user_id", userId)
          .eq("content_type", p.content_type)
          .eq("content_id", p.content_id)
          .order("listened_at", { ascending: false })
          .limit(1)
          .single();
        return {
          contentType: p.content_type,
          contentId: p.content_id,
          title: histRow?.title ?? (p.content_type === "surah" ? `Surah ${p.content_id}` : p.content_id),
          seriesName: histRow?.series_name ?? undefined,
          seriesId: histRow?.series_id ?? undefined,
          durationMs: p.duration_ms ?? 0,
          completedAt: p.updated_at,
        };
      })
    );
    return results;
  } catch { return []; }
}

export async function getTotalHoursListened(userId: string): Promise<number> {
  try {
    const [histRes, progressRes] = await Promise.all([
      supabase.from("listening_history").select("duration_ms").eq("user_id", userId),
      supabase.from("listening_progress").select("position_ms").eq("user_id", userId),
    ]);
    const histMs = (histRes.data ?? []).reduce((sum: number, r: any) => sum + (r.duration_ms ?? 0), 0);
    if (histMs > 0) return Math.round((histMs / 3_600_000) * 10) / 10;
    // Fallback: sum of position_ms from listening_progress (how far the user got in each item)
    const progressMs = (progressRes.data ?? []).reduce((sum: number, r: any) => sum + (r.position_ms ?? 0), 0);
    return Math.round((progressMs / 3_600_000) * 10) / 10;
  } catch { return 0; }
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  id: string;
  display_name: string;
  avatar_url: string | null;
  country: string | null;
  xp: number;
  level: number;
  current_streak: number;
  rank: number;
}

export async function getLeaderboardGlobal(limit = 50): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("id, display_name, avatar_url, country, total_xp, level, current_streak, rank")
    .order("rank")
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    display_name: r.display_name || "Anonymous",
    avatar_url: r.avatar_url,
    country: r.country,
    xp: r.total_xp ?? 0,
    level: r.level ?? 1,
    current_streak: r.current_streak ?? 0,
    rank: Number(r.rank),
  }));
}

export async function getLeaderboardByCountry(country: string, limit = 50): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("id, display_name, avatar_url, country, total_xp, level, current_streak, rank")
    .eq("country", country)
    .order("rank")
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    display_name: r.display_name || "Anonymous",
    avatar_url: r.avatar_url,
    country: r.country,
    xp: r.total_xp ?? 0,
    level: r.level ?? 1,
    current_streak: r.current_streak ?? 0,
    rank: Number(r.rank),
  }));
}

export async function getLeaderboardWeekly(limit = 50): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard_weekly")
    .select("id, display_name, avatar_url, country, weekly_xp, rank")
    .order("rank")
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    display_name: r.display_name,
    avatar_url: r.avatar_url,
    country: r.country,
    xp: r.weekly_xp,
    level: 0,
    current_streak: 0,
    rank: Number(r.rank),
  }));
}

export async function getLeaderboardMonthly(limit = 50): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard_monthly")
    .select("id, display_name, avatar_url, country, monthly_xp, rank")
    .order("rank")
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    display_name: r.display_name,
    avatar_url: r.avatar_url,
    country: r.country,
    xp: r.monthly_xp,
    level: 0,
    current_streak: 0,
    rank: Number(r.rank),
  }));
}

// ─── BADGES ──────────────────────────────────────────────────────────────────
export async function getEarnedBadgeSlugs(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("user_badges")
      .select("badges(slug)")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map((r: any) => r.badges?.slug).filter(Boolean);
  } catch { return []; }
}

export async function checkAndAwardBadges(userId: string): Promise<void> {
  try {
    await supabase.rpc("check_and_award_badges", { p_user_id: userId });
  } catch (err) { console.warn("[checkAndAwardBadges]", err); }
}

// ─── PROGRESS ANALYTICS ──────────────────────────────────────────────────────

// Returns 7 values (Mon–Sun of current week), in minutes
export async function getWeeklyListeningMinutes(userId: string): Promise<number[]> {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const mondayIso = monday.toISOString();

    // Primary source: listening_history (per-session records)
    const [histRes, progressRes] = await Promise.all([
      supabase
        .from("listening_history")
        .select("duration_ms, listened_at")
        .eq("user_id", userId)
        .gte("listened_at", mondayIso),
      supabase
        .from("listening_progress")
        .select("position_ms, updated_at")
        .eq("user_id", userId)
        .gte("updated_at", mondayIso),
    ]);

    const histDays = [0, 0, 0, 0, 0, 0, 0]; // Mon–Sun
    (histRes.data ?? []).forEach((r: any) => {
      const d = new Date(r.listened_at);
      const idx = (d.getDay() + 6) % 7;
      histDays[idx] += Math.round((r.duration_ms ?? 0) / 60_000);
    });

    const histTotal = histDays.reduce((a, b) => a + b, 0);
    if (histTotal > 0) return histDays;

    // Fallback: listening_progress.updated_at — reliable since saveProgress runs every 15 s
    const progDays = [0, 0, 0, 0, 0, 0, 0];
    (progressRes.data ?? []).forEach((r: any) => {
      if (!r.position_ms || r.position_ms <= 0) return;
      const d = new Date(r.updated_at);
      const idx = (d.getDay() + 6) % 7;
      progDays[idx] += Math.round((r.position_ms ?? 0) / 60_000);
    });
    return progDays;
  } catch { return [0, 0, 0, 0, 0, 0, 0]; }
}

// Returns 35 intensity values (0–1) oldest → newest for heatmap
export async function getHeatmapActivity(userId: string, days = 35): Promise<number[]> {
  try {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data } = await supabase
      .from("daily_xp_log")
      .select("xp_amount, earned_at")
      .eq("user_id", userId)
      .gte("earned_at", cutoff);

    const dayMap: Record<string, number> = {};
    (data ?? []).forEach((r: any) => {
      const date = r.earned_at.slice(0, 10);
      dayMap[date] = (dayMap[date] ?? 0) + r.xp_amount;
    });

    const result: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      const xp = dayMap[d] ?? 0;
      result.push(Math.min(1, xp / 80)); // 80 XP = full intensity
    }
    return result;
  } catch { return Array(days).fill(0); }
}

// Returns journey summary
export async function getJourneyCompletion(userId: string): Promise<{
  completedChapters: number;
  totalChapters: number;
  currentChapter: number;
  pct: number;
}> {
  try {
    const { data } = await supabase
      .from("journey_progress")
      .select("chapter_number, completed, progress_pct")
      .eq("user_id", userId)
      .order("chapter_number");

    const rows = data ?? [];
    const completed = rows.filter((r: any) => r.completed).length;
    const inProgress = rows.filter((r: any) => !r.completed);
    const currentChapter = inProgress.length > 0
      ? inProgress[0].chapter_number
      : rows.length > 0 ? rows[rows.length - 1].chapter_number + 1 : 1;

    const pct = Math.round((completed / 20) * 100);
    return { completedChapters: completed, totalChapters: 20, currentChapter: Math.min(currentChapter, 20), pct };
  } catch { return { completedChapters: 0, totalChapters: 20, currentChapter: 1, pct: 0 }; }
}

// ─── FAVOURITES ──────────────────────────────────────────────────────────────
export async function addFavourite(userId: string, item: { contentType: "surah" | "episode" | "series"; contentId: string; title: string; seriesName?: string; coverColor?: string }) {
  try {
    const { error } = await supabase.from("favourites").upsert({
      user_id: userId,
      content_type: item.contentType,
      content_id: item.contentId,
      title: item.title,
      series_name: item.seriesName ?? null,
      cover_color: item.coverColor ?? null,
    }, { onConflict: "user_id,content_type,content_id" });
    if (error) console.warn("[addFavourite]", error.message);
  } catch (err) { console.warn("[addFavourite]", err); }
}

export async function removeFavourite(userId: string, contentType: string, contentId: string) {
  try {
    const { error } = await supabase.from("favourites").delete().eq("user_id", userId).eq("content_type", contentType).eq("content_id", contentId);
    if (error) console.warn("[removeFavourite]", error.message);
  } catch (err) { console.warn("[removeFavourite]", err); }
}

export async function getFavourites(userId: string) {
  try {
    const { data } = await supabase.from("favourites").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    return data ?? [];
  } catch { return []; }
}

// ─── BOOKMARKS ───────────────────────────────────────────────────────────────
export async function addBookmark(userId: string, item: { contentType: "surah" | "episode" | "series"; contentId: string; title: string; seriesName?: string; coverColor?: string }) {
  try {
    const { error } = await supabase.from("bookmarks").upsert({
      user_id: userId,
      content_type: item.contentType,
      content_id: item.contentId,
      title: item.title,
      series_name: item.seriesName ?? null,
      cover_color: item.coverColor ?? null,
    }, { onConflict: "user_id,content_type,content_id" });
    if (error) console.warn("[addBookmark]", error.message);
  } catch (err) { console.warn("[addBookmark]", err); }
}

export async function removeBookmark(userId: string, contentType: string, contentId: string) {
  try {
    const { error } = await supabase.from("bookmarks").delete().eq("user_id", userId).eq("content_type", contentType).eq("content_id", contentId);
    if (error) console.warn("[removeBookmark]", error.message);
  } catch (err) { console.warn("[removeBookmark]", err); }
}

export async function getBookmarks(userId: string) {
  try {
    const { data } = await supabase.from("bookmarks").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    return data ?? [];
  } catch { return []; }
}

// ─── DOWNLOADS ───────────────────────────────────────────────────────────────
export async function addDownload(userId: string, item: { contentType: "surah" | "episode"; contentId: string; title: string; fileSizeBytes?: number }) {
  try {
    const { error } = await supabase.from("downloads").upsert({
      user_id: userId,
      content_type: item.contentType,
      content_id: item.contentId,
      title: item.title,
      file_size_bytes: item.fileSizeBytes ?? null,
    }, { onConflict: "user_id,content_type,content_id" });
    if (error) console.warn("[addDownload]", error.message);
  } catch (err) { console.warn("[addDownload]", err); }
}

export async function removeDownload(userId: string, contentType: string, contentId: string) {
  try {
    const { error } = await supabase.from("downloads").delete().eq("user_id", userId).eq("content_type", contentType).eq("content_id", contentId);
    if (error) console.warn("[removeDownload]", error.message);
  } catch (err) { console.warn("[removeDownload]", err); }
}

export async function getDownloads(userId: string) {
  try {
    const { data } = await supabase.from("downloads").select("*").eq("user_id", userId).order("downloaded_at", { ascending: false });
    return data ?? [];
  } catch { return []; }
}

// ─── REFERRALS ───────────────────────────────────────────────────────────────

async function fetchReferralCodeWithRetry(userId: string, attempt = 0): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .single();

  if (error) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      return fetchReferralCodeWithRetry(userId, attempt + 1);
    }
    console.error("[getUserReferralCode] Failed after retries:", error.message);
    return null;
  }
  return data?.referral_code ?? null;
}

export async function getUserReferralCode(userId: string): Promise<string | null> {
  try {
    const existing = await fetchReferralCodeWithRetry(userId);
    if (existing) return existing;

    const generated = "SG" + userId.replace(/-/g, "").substring(0, 6).toUpperCase();
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ referral_code: generated })
      .eq("id", userId)
      .is("referral_code", null);

    if (updateErr) {
      console.error("[getUserReferralCode] Failed to persist generated code:", updateErr.message);
      return generated;
    }
    return generated;
  } catch (err: any) {
    console.error("[getUserReferralCode] Unexpected error:", err?.message ?? err);
    return "SG" + userId.replace(/-/g, "").substring(0, 6).toUpperCase();
  }
}

export interface ReferralStats {
  friendsReferred: number;
  xpEarned: number;
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  try {
    const { data } = await supabase
      .from("referrals")
      .select("xp_awarded_referrer")
      .eq("referrer_id", userId);
    const rows = data ?? [];
    return {
      friendsReferred: rows.length,
      xpEarned: rows.reduce((sum, r: any) => sum + (r.xp_awarded_referrer ?? 500), 0),
    };
  } catch { return { friendsReferred: 0, xpEarned: 0 }; }
}

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://b3066f7f-4587-47c6-b796-d666ca698a6e-00-2fxwjwo5j3r6u.pike.replit.dev/api";

// ── Fetch authoritative user stats from API server (service-role, bypasses RLS) ──
// Use this instead of supabase client queries when you need guaranteed fresh data.
export async function fetchMyStats(token: string): Promise<{
  xp: number; level: number; streak: number; longest_streak: number;
  is_premium: boolean; display_name: string | null; avatar_url: string | null;
  bio: string | null; country: string | null; joined_at: string | null;
} | null> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8_000);
    const resp = await fetch(`${API_BASE}/user/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }).finally(() => clearTimeout(tid));
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

export async function applyReferralCode(code: string, token?: string): Promise<{
  success: boolean;
  error?: string;
  xpBonus?: number;
  type?: string;
  freeDays?: number;
  description?: string;
}> {
  return redeemCode(code, token);
}

// Unified code redemption — handles both referral codes AND coupon codes.
// ALL redemptions go through the API server (service-role, server-side).
// Pass `token` directly to avoid supabase.auth.getSession() which can hang in RN.
export async function redeemCode(code: string, token?: string): Promise<{
  success: boolean;
  error?: string;
  xpBonus?: number;
  type?: string;
  freeDays?: number;
  description?: string;
}> {
  try {
    const cleanCode = code.trim().toUpperCase();

    // Use the provided token first; only call getSession() as a fallback.
    let accessToken = token;
    if (!accessToken) {
      const { data: { session } } = await supabase.auth.getSession();
      accessToken = session?.access_token;
    }
    if (!accessToken) return { success: false, error: "not_authenticated" };

    // 20-second timeout so the button never hangs forever.
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 20_000);

    const resp = await fetch(`${API_BASE}/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ code: cleanCode }),
      signal: controller.signal,
    }).finally(() => clearTimeout(tid));

    if (!resp.ok) {
      console.error("[redeemCode] HTTP error:", resp.status);
      return { success: false, error: "server_error" };
    }

    const result = await resp.json();
    return {
      success:     result.success === true,
      error:       result.error,
      type:        result.type,
      xpBonus:     result.xp_bonus ?? result.xpBonus,
      freeDays:    result.free_days,
      description: result.description,
    };
  } catch (e: any) {
    if ((e as any)?.name === "AbortError") return { success: false, error: "Request timed out. Please try again." };
    return { success: false, error: e?.message ?? "Unknown error" };
  }
}

// ─── REFERRAL HISTORY ────────────────────────────────────────────────────────

export interface ReferralHistoryItem {
  referredId: string;
  referredName: string;
  joinedAt: string;
  xpEarned: number;
}

export async function getReferralHistory(userId: string): Promise<ReferralHistoryItem[]> {
  try {
    const { data } = await supabase
      .from("referrals")
      .select("referred_id, xp_awarded_referrer, created_at")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!data || data.length === 0) return [];

    const referredIds = (data as any[]).map((r) => r.referred_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", referredIds);

    const nameMap = new Map<string, string>();
    (profiles ?? []).forEach((p: any) => nameMap.set(p.id, p.display_name || "Friend"));

    return (data as any[]).map((r) => ({
      referredId:   r.referred_id,
      referredName: nameMap.get(r.referred_id) ?? "Friend",
      joinedAt:     r.created_at,
      xpEarned:     r.xp_awarded_referrer ?? 500,
    }));
  } catch { return []; }
}

export async function getMyReferrer(userId: string): Promise<{ name: string; code: string } | null> {
  try {
    const { data } = await supabase
      .from("referrals")
      .select("code_used, referrer_id")
      .eq("referred_id", userId)
      .maybeSingle();

    if (!data) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", (data as any).referrer_id)
      .maybeSingle();

    return {
      name: (profile as any)?.display_name ?? "Friend",
      code: (data as any).code_used,
    };
  } catch { return null; }
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
export async function getUserSettings(userId: string) {
  try {
    const { data } = await supabase.from("user_settings").select("*").eq("user_id", userId).single();
    return data;
  } catch { return null; }
}

export async function updateUserSettings(userId: string, settings: Partial<{
  quran_reciter: string;
  quran_translation_edition: string;
  quran_show_arabic: boolean;
  quran_show_translation: boolean;
  autoplay: boolean;
  background_play: boolean;
  download_wifi_only: boolean;
  notifications_enabled: boolean;
  streak_reminder: boolean;
  auto_scroll: boolean;
}>) {
  try {
    const { error } = await supabase.from("user_settings").upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) console.warn("[updateUserSettings]", error.message);
  } catch (err) { console.warn("[updateUserSettings]", err); }
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
export interface DbNotification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  action_type: string | null;
  action_payload: Record<string, any> | null;
  image_url: string | null;
  created_at: string;
}

export async function getNotifications(userId: string): Promise<DbNotification[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as DbNotification[];
  } catch { return []; }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
    if (error) console.warn("[markNotificationRead]", error.message);
  } catch (err) { console.warn("[markNotificationRead]", err); }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) console.warn("[markAllNotificationsRead]", error.message);
  } catch (err) { console.warn("[markAllNotificationsRead]", err); }
}

export async function seedNotificationsIfEmpty(userId: string): Promise<DbNotification[]> {
  try {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if ((count ?? 0) > 0) return [];

    const seeds = [
      {
        user_id: userId,
        title: "Welcome to StayGuided Me",
        body: "Assalamu Alaikum! Start your Islamic audio journey today.",
        type: "general",
        action_type: "series",
        action_payload: { seriesId: "s1" },
        is_read: false,
      },
      {
        user_id: userId,
        title: "New Series Available",
        body: "The Story of Musa (AS) is now available. Start listening today!",
        type: "content",
        action_type: "series",
        action_payload: { seriesId: "s3" },
        is_read: false,
      },
      {
        user_id: userId,
        title: "Journey Progress",
        body: "You've completed Chapter 3 of Journey Through Islam. Keep going!",
        type: "progress",
        action_type: "journey",
        action_payload: {},
        is_read: true,
      },
      {
        user_id: userId,
        title: "Daily Qur'an Reminder",
        body: "Don't forget your daily Qur'an listening. Al-Baqarah awaits you.",
        type: "reminder",
        action_type: "quran",
        action_payload: { surahNumber: 2 },
        is_read: true,
      },
      {
        user_id: userId,
        title: "Streak Milestone",
        body: "Amazing! You've maintained a 7-day listening streak. Keep it up!",
        type: "achievement",
        action_type: "profile",
        action_payload: {},
        is_read: true,
      },
    ];

    const { data, error } = await supabase
      .from("notifications")
      .insert(seeds)
      .select();
    if (error) throw error;
    return (data ?? []) as DbNotification[];
  } catch { return []; }
}

// ─── SUBSCRIPTIONS ───────────────────────────────────────────────────────────
export async function getSubscription(userId: string) {
  try {
    const { data } = await supabase.from("subscriptions").select("*").eq("user_id", userId).single();
    return data;
  } catch { return null; }
}

// ─── COUNTRY / PROFILE ────────────────────────────────────────────────────────
export async function getUserCountry(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("country")
      .eq("id", userId)
      .maybeSingle();
    return data?.country ?? null;
  } catch { return null; }
}

export async function updateUserCountry(userId: string, country: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ country })
    .eq("id", userId);
  if (error) throw error;
}

// ─── CONTENT LIKES ───────────────────────────────────────────────────────────
export async function toggleContentLike(
  userId: string,
  contentType: string,
  contentId: string,
): Promise<{ liked: boolean }> {
  try {
    const { data: existing } = await supabase
      .from("content_likes")
      .select("id")
      .eq("user_id", userId)
      .eq("content_type", contentType)
      .eq("content_id", contentId)
      .maybeSingle();
    if (existing) {
      await supabase.from("content_likes").delete().eq("id", existing.id);
      return { liked: false };
    } else {
      await supabase.from("content_likes").insert({ user_id: userId, content_type: contentType, content_id: contentId });
      return { liked: true };
    }
  } catch { return { liked: false }; }
}

export async function getContentLikeStatus(
  userId: string,
  contentType: string,
  contentId: string,
): Promise<{ isLiked: boolean; count: number }> {
  try {
    const [likedRes, countRes] = await Promise.all([
      supabase.from("content_likes").select("id").eq("user_id", userId).eq("content_type", contentType).eq("content_id", contentId).maybeSingle(),
      supabase.from("content_likes").select("id", { count: "exact", head: true }).eq("content_type", contentType).eq("content_id", contentId),
    ]);
    return { isLiked: !!likedRes.data, count: countRes.count ?? 0 };
  } catch { return { isLiked: false, count: 0 }; }
}

export async function getContentLikeCount(contentType: string, contentId: string): Promise<number> {
  try {
    const { count } = await supabase.from("content_likes").select("id", { count: "exact", head: true }).eq("content_type", contentType).eq("content_id", contentId);
    return count ?? 0;
  } catch { return 0; }
}

// ─── CONTENT COMMENTS ────────────────────────────────────────────────────────
export interface ContentComment {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
  isOwn: boolean;
}

export async function getContentComments(
  contentType: string,
  contentId: string,
  currentUserId?: string,
): Promise<{ comments: ContentComment[]; count: number }> {
  try {
    const { data, count } = await supabase
      .from("content_comments")
      .select("id, user_id, body, created_at", { count: "exact" })
      .eq("content_type", contentType)
      .eq("content_id", contentId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(100);

    const rows = data ?? [];
    const userIds = [...new Set(rows.map((r: any) => r.user_id as string))];
    const profileMap = new Map<string, { display_name?: string; avatar_url?: string }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);
      (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
    }

    const comments: ContentComment[] = rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      displayName: profileMap.get(r.user_id)?.display_name ?? "User",
      avatarUrl: profileMap.get(r.user_id)?.avatar_url ?? null,
      body: r.body,
      createdAt: r.created_at,
      isOwn: r.user_id === currentUserId,
    }));
    return { comments, count: count ?? comments.length };
  } catch { return { comments: [], count: 0 }; }
}

export async function getContentCommentCount(contentType: string, contentId: string): Promise<number> {
  try {
    const { count } = await supabase.from("content_comments").select("id", { count: "exact", head: true }).eq("content_type", contentType).eq("content_id", contentId).eq("is_deleted", false);
    return count ?? 0;
  } catch { return 0; }
}

export async function addContentComment(
  userId: string,
  contentType: string,
  contentId: string,
  body: string,
): Promise<ContentComment | null> {
  try {
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > 500) return null;
    const { data, error } = await supabase
      .from("content_comments")
      .insert({ user_id: userId, content_type: contentType, content_id: contentId, body: trimmed })
      .select("id, user_id, body, created_at")
      .single();
    if (error) { console.warn("[addContentComment]", error.message); return null; }
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    return {
      id: data.id,
      userId: data.user_id,
      displayName: profile?.display_name ?? "User",
      avatarUrl: profile?.avatar_url ?? null,
      body: data.body,
      createdAt: data.created_at,
      isOwn: true,
    };
  } catch { return null; }
}

export async function softDeleteContentComment(commentId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("content_comments").update({ is_deleted: true }).eq("id", commentId);
    return !error;
  } catch { return false; }
}

// ─── COMMENT BLOCKING ─────────────────────────────────────────────────────────
export async function isUserCommentBlocked(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("comment_blocked_users")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return !!data;
  } catch { return false; }
}
