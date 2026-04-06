import { Router } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getPgPool } from "../lib/pgClient.js";

const router = Router();

const SUPABASE_URL = "https://tkruzfskhtcazjxdracm.supabase.co";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

let _adminClient: SupabaseClient | null = null;
function getAdminClient(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _adminClient;
}

function decodeJwt(authHeader: string | undefined): { sub?: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = authHeader.slice(7).split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch { return null; }
}

async function getRequesterRole(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("role").eq("id", userId).single();
  return data?.role ?? null;
}

function isAdmin(role: string | null): boolean {
  return role === "admin" || role === "super_admin";
}

// ── POST /api/admin/users/:userId/block ──────────────────────────────────────
router.post("/admin/users/:userId/block", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    const reqRole = await getRequesterRole(admin, decoded.sub);
    if (!isAdmin(reqRole)) { res.status(403).json({ error: "Forbidden" }); return; }

    const { userId } = req.params;
    const { reason } = req.body as { reason?: string };
    const { error } = await admin.from("profiles")
      .update({ is_blocked: true, blocked_reason: reason || null })
      .eq("id", userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:userId/unblock ────────────────────────────────────
router.post("/admin/users/:userId/unblock", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const { userId } = req.params;
    const { error } = await admin.from("profiles")
      .update({ is_blocked: false, blocked_reason: null })
      .eq("id", userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:userId/grant-premium ──────────────────────────────
router.post("/admin/users/:userId/grant-premium", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const { userId } = req.params;
    const { days, plan } = req.body as { days: number; plan: string };
    const expires = plan === "lifetime" ? null : new Date(Date.now() + days * 86_400_000).toISOString();

    await Promise.all([
      admin.from("profiles").update({
        subscription_tier: "premium",
        subscription_expires_at: expires,
      }).eq("id", userId),
      admin.from("subscriptions").upsert(
        { user_id: userId, plan, status: "active", started_at: new Date().toISOString(), expires_at: expires, provider: "admin" },
        { onConflict: "user_id" }
      ),
    ]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:userId/revoke-premium ─────────────────────────────
router.post("/admin/users/:userId/revoke-premium", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const { userId } = req.params;
    await Promise.all([
      admin.from("profiles").update({ subscription_tier: "free", subscription_expires_at: null }).eq("id", userId),
      admin.from("subscriptions").update({ status: "cancelled" }).eq("user_id", userId),
    ]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:userId/award-xp ───────────────────────────────────
router.post("/admin/users/:userId/award-xp", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const { userId } = req.params;
    const { amount, reason } = req.body as { amount: number; reason?: string };

    await admin.from("user_xp").upsert(
      { user_id: userId, total_xp: 0, level: 1 },
      { onConflict: "user_id", ignoreDuplicates: true }
    );
    const { data: row } = await admin.from("user_xp").select("total_xp").eq("user_id", userId).single();
    const newTotal = Math.max(0, (row?.total_xp ?? 0) + amount);

    await Promise.all([
      admin.from("user_xp").update({
        total_xp: newTotal,
        level: Math.max(1, Math.floor(newTotal / 500) + 1),
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId),
      admin.from("daily_xp_log").insert({
        user_id: userId,
        xp_amount: amount,
        reason: reason || (amount > 0 ? "Admin manual award" : "Admin manual deduction"),
      }),
    ]);
    res.json({ success: true, new_total: newTotal });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:userId/update-name ────────────────────────────────
router.post("/admin/users/:userId/update-name", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const { userId } = req.params;
    const { name } = req.body as { name: string };
    const { error } = await admin.from("profiles").update({ display_name: name.trim() }).eq("id", userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:userId/update-role ────────────────────────────────
router.post("/admin/users/:userId/update-role", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    const reqRole = await getRequesterRole(admin, decoded.sub);
    if (!isAdmin(reqRole)) { res.status(403).json({ error: "Forbidden" }); return; }

    const { userId } = req.params;
    const { role } = req.body as { role: string };

    if (role === "super_admin" && reqRole !== "super_admin") {
      res.status(403).json({ error: "Only Super Admin can assign the Super Admin role" }); return;
    }

    const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:userId/award-badge ────────────────────────────────
router.post("/admin/users/:userId/award-badge", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const { userId } = req.params;
    const { badgeId } = req.body as { badgeId: string };

    // Check if already has badge
    const { data: existing } = await admin.from("user_badges").select("id").eq("user_id", userId).eq("badge_id", badgeId).maybeSingle();
    if (existing) { res.json({ success: true, already_had: true }); return; }

    // Get badge XP reward
    const { data: badge } = await admin.from("badges").select("xp_reward").eq("id", badgeId).single();
    const xpReward = (badge as any)?.xp_reward ?? 0;

    // Award badge
    const { error: insertErr } = await admin.from("user_badges").insert({ user_id: userId, badge_id: badgeId });
    if (insertErr) throw insertErr;

    // Award XP if badge has xp_reward
    if (xpReward > 0) {
      await admin.from("user_xp").upsert({ user_id: userId, total_xp: 0, level: 1 }, { onConflict: "user_id", ignoreDuplicates: true });
      const { data: xpRow } = await admin.from("user_xp").select("total_xp").eq("user_id", userId).single();
      const newTotal = (xpRow as any)?.total_xp + xpReward;
      await Promise.all([
        admin.from("user_xp").update({ total_xp: newTotal, level: Math.max(1, Math.floor(newTotal / 500) + 1) }).eq("user_id", userId),
        admin.from("daily_xp_log").insert({ user_id: userId, xp_amount: xpReward, reason: "badge_awarded" }),
      ]);
    }

    res.json({ success: true, xp_reward: xpReward });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:userId/revoke-badge ───────────────────────────────
router.post("/admin/users/:userId/revoke-badge", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const { userId } = req.params;
    const { badgeId } = req.body as { badgeId: string };

    const { error } = await admin.from("user_badges").delete().eq("user_id", userId).eq("badge_id", badgeId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:userId/reset-password ─────────────────────────────
router.post("/admin/users/:userId/reset-password", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const { userId } = req.params;
    const { password } = req.body as { password: string };
    if (!password || password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }

    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:userId/delete ─────────────────────────────────────
router.post("/admin/users/:userId/delete", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    const reqRole = await getRequesterRole(admin, decoded.sub);
    if (reqRole !== "super_admin") { res.status(403).json({ error: "Only Super Admin can delete users" }); return; }

    const { userId } = req.params;
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/comments ──────────────────────────────────────────────────
router.get("/admin/comments", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const page = parseInt((req.query.page as string) ?? "0", 10);
    const pageSize = parseInt((req.query.pageSize as string) ?? "25", 10);
    const filterType = (req.query.filterType as string) ?? "all";
    const filterStatus = (req.query.filterStatus as string) ?? "all";
    const search = (req.query.search as string) ?? "";
    const offset = page * pageSize;

    const conditions: string[] = [];
    const params: any[] = [];

    if (filterType !== "all") { params.push(filterType); conditions.push(`c.content_type = $${params.length}`); }
    if (filterStatus === "active") { conditions.push(`c.is_deleted = false AND c.is_flagged = false`); }
    else if (filterStatus === "flagged") { conditions.push(`c.is_flagged = true`); }
    else if (filterStatus === "deleted") { conditions.push(`c.is_deleted = true`); }
    if (search) { params.push(`%${search}%`); conditions.push(`c.body ILIKE $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const pool = getPgPool();
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM public.content_comments c ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(pageSize, offset);
    const dataRes = await pool.query(
      `SELECT c.id, c.user_id, c.content_type, c.content_id, c.body, c.is_deleted, c.is_flagged, c.created_at,
              p.display_name, p.email
       FROM public.content_comments c
       LEFT JOIN public.comment_user_profiles p ON p.user_id = c.user_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ comments: dataRes.rows, total });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/comment-blocked-users ─────────────────────────────────────
router.get("/admin/comment-blocked-users", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const pool = getPgPool();
    const result = await pool.query(`SELECT user_id FROM public.comment_blocked_users`);
    res.json({ blocked: result.rows.map((r: any) => r.user_id) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/comments/:id/soft-delete ─────────────────────────────────
router.post("/admin/comments/:id/soft-delete", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const pool = getPgPool();
    await pool.query(`UPDATE public.content_comments SET is_deleted = true WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/comments/:id/restore ─────────────────────────────────────
router.post("/admin/comments/:id/restore", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const pool = getPgPool();
    await pool.query(`UPDATE public.content_comments SET is_deleted = false WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/comments/:id/flag ────────────────────────────────────────
router.post("/admin/comments/:id/flag", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const { flagged } = req.body as { flagged: boolean };
    const pool = getPgPool();
    await pool.query(`UPDATE public.content_comments SET is_flagged = $1 WHERE id = $2`, [flagged, req.params.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/comment-blocked-users/:userId/block ──────────────────────
router.post("/admin/comment-blocked-users/:userId/block", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const pool = getPgPool();
    await pool.query(
      `INSERT INTO public.comment_blocked_users (user_id, blocked_by) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET blocked_by = EXCLUDED.blocked_by`,
      [req.params.userId, decoded.sub]
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/comment-blocked-users/:userId/unblock ────────────────────
router.post("/admin/comment-blocked-users/:userId/unblock", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const pool = getPgPool();
    await pool.query(`DELETE FROM public.comment_blocked_users WHERE user_id = $1`, [req.params.userId]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/invite ────────────────────────────────────────────────────
router.post("/admin/invite", async (req, res) => {
  try {
    const decoded = decodeJwt(req.headers.authorization);
    if (!decoded?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = getAdminClient();
    if (!isAdmin(await getRequesterRole(admin, decoded.sub))) { res.status(403).json({ error: "Forbidden" }); return; }

    const { email, role } = req.body as { email: string; role?: string };
    if (!email) { res.status(400).json({ error: "Email is required" }); return; }

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { role: role || "support" },
    });
    if (error) throw error;

    // Set role in profiles table after invite
    if (data?.user?.id) {
      await admin.from("profiles").upsert(
        { id: data.user.id, email, role: role || "support" },
        { onConflict: "id" }
      );
    }
    res.json({ success: true, userId: data?.user?.id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
