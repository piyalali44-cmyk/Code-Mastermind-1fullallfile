import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { getPgPool } from "../lib/pgClient.js";

const router = Router();

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "https://tkruzfskhtcazjxdracm.supabase.co";
const SUPABASE_ANON_KEY = process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
let _sb: ReturnType<typeof createClient> | null = null;
function getSb() {
  if (!_sb && SUPABASE_ANON_KEY) {
    _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return _sb;
}

function decodeJwt(authHeader: string | undefined): { sub?: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = authHeader.slice(7).split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch { return null; }
}

// ── GET /api/content/likes/status ──────────────────────────────────────────
// ?contentType=episode&contentId=xxx
router.get("/content/likes/status", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    const userId = decoded?.sub ?? null;
    const { contentType, contentId } = req.query as Record<string, string>;
    if (!contentType || !contentId) { res.status(400).json({ error: "contentType and contentId required" }); return; }

    const pool = getPgPool();
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM content_likes WHERE content_type = $1 AND content_id = $2`,
      [contentType, contentId]
    );
    const count = parseInt(countRes.rows[0].count, 10);
    let isLiked = false;
    if (userId) {
      const likedRes = await pool.query(
        `SELECT id FROM content_likes WHERE user_id = $1 AND content_type = $2 AND content_id = $3`,
        [userId, contentType, contentId]
      );
      isLiked = likedRes.rows.length > 0;
    }
    res.json({ isLiked, count });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/content/likes/toggle ─────────────────────────────────────────
router.post("/content/likes/toggle", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { contentType, contentId } = req.body as { contentType: string; contentId: string };
    if (!contentType || !contentId) { res.status(400).json({ error: "contentType and contentId required" }); return; }

    const pool = getPgPool();
    const existing = await pool.query(
      `SELECT id FROM content_likes WHERE user_id = $1 AND content_type = $2 AND content_id = $3`,
      [decoded.sub, contentType, contentId]
    );
    if (existing.rows.length > 0) {
      await pool.query(`DELETE FROM content_likes WHERE id = $1`, [existing.rows[0].id]);
    } else {
      await pool.query(
        `INSERT INTO content_likes (user_id, content_type, content_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [decoded.sub, contentType, contentId]
      );
    }
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM content_likes WHERE content_type = $1 AND content_id = $2`,
      [contentType, contentId]
    );
    res.json({ liked: existing.rows.length === 0, count: parseInt(countRes.rows[0].count, 10) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/content/comments ───────────────────────────────────────────────
// ?contentType=episode&contentId=xxx
router.get("/content/comments", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    const currentUserId = decoded?.sub ?? null;
    const { contentType, contentId } = req.query as Record<string, string>;
    if (!contentType || !contentId) { res.status(400).json({ error: "contentType and contentId required" }); return; }

    const pool = getPgPool();
    const result = await pool.query(
      `SELECT c.id, c.user_id, c.body, c.created_at,
              p.display_name, p.email
       FROM content_comments c
       LEFT JOIN comment_user_profiles p ON p.user_id = c.user_id
       WHERE c.content_type = $1 AND c.content_id = $2 AND c.is_deleted = false
       ORDER BY c.created_at ASC
       LIMIT 200`,
      [contentType, contentId]
    );

    const rows = result.rows;
    const unknownUserIds = [...new Set(rows.filter((r: any) => !r.display_name).map((r: any) => r.user_id))];

    if (unknownUserIds.length > 0) {
      const sb = getSb();
      if (sb) {
        const { data: profiles } = await sb.from("profiles").select("id, display_name, avatar_url").in("id", unknownUserIds);
        if (profiles && profiles.length > 0) {
          const inserts = profiles.map((p: any) =>
            pool.query(
              `INSERT INTO comment_user_profiles (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
              [p.id, p.display_name ?? "User"]
            )
          );
          await Promise.allSettled(inserts);
          const profileMap = new Map(profiles.map((p: any) => [p.id, p]));
          rows.forEach((r: any) => {
            if (!r.display_name) {
              const p = profileMap.get(r.user_id);
              r.display_name = p?.display_name ?? "User";
              r.avatar_url = p?.avatar_url ?? null;
            }
          });
        }
      }
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM content_comments WHERE content_type = $1 AND content_id = $2 AND is_deleted = false`,
      [contentType, contentId]
    );

    res.json({
      comments: rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        displayName: r.display_name ?? "User",
        avatarUrl: r.avatar_url ?? null,
        body: r.body,
        createdAt: r.created_at,
        isOwn: r.user_id === currentUserId,
      })),
      count: parseInt(countRes.rows[0].count, 10),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/content/comments ─────────────────────────────────────────────
router.post("/content/comments", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { contentType, contentId, body, displayName } = req.body as {
      contentType: string; contentId: string; body: string; displayName?: string;
    };
    if (!contentType || !contentId || !body?.trim()) { res.status(400).json({ error: "Missing required fields" }); return; }
    if (body.trim().length > 2000) { res.status(400).json({ error: "Comment too long" }); return; }

    const pool = getPgPool();

    const blocked = await pool.query(`SELECT user_id FROM comment_blocked_users WHERE user_id = $1`, [decoded.sub]);
    if (blocked.rows.length > 0) { res.status(403).json({ error: "You are blocked from commenting" }); return; }

    if (displayName) {
      await pool.query(
        `INSERT INTO comment_user_profiles (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
        [decoded.sub, displayName]
      );
    }

    const result = await pool.query(
      `INSERT INTO content_comments (user_id, content_type, content_id, body) VALUES ($1, $2, $3, $4) RETURNING id, user_id, body, created_at`,
      [decoded.sub, contentType, contentId, body.trim()]
    );
    const row = result.rows[0];
    res.json({
      id: row.id,
      userId: row.user_id,
      displayName: displayName ?? "User",
      avatarUrl: null,
      body: row.body,
      createdAt: row.created_at,
      isOwn: true,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/content/comments/:id ──────────────────────────────────────
router.delete("/content/comments/:id", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }

    const pool = getPgPool();
    await pool.query(
      `UPDATE content_comments SET is_deleted = true WHERE id = $1 AND user_id = $2`,
      [req.params.id, decoded.sub]
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/content/comment-blocked ──────────────────────────────────────
router.get("/content/comment-blocked", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.json({ blocked: false }); return; }

    const pool = getPgPool();
    const result = await pool.query(`SELECT user_id FROM comment_blocked_users WHERE user_id = $1`, [decoded.sub]);
    res.json({ blocked: result.rows.length > 0 });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
