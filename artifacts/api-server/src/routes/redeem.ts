import { Router, type IRouter } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const SUPABASE_URL = "https://tkruzfskhtcazjxdracm.supabase.co";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

let _adminClient: SupabaseClient | null = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _adminClient;
}

// Lightweight JWT decode (no verify — service role still validates via RLS).
// Extracts sub (user id) from the JWT payload without a network round-trip.
function extractUserId(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = authHeader.slice(7).split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof decoded?.sub === "string" ? decoded.sub : null;
  } catch {
    return null;
  }
}

// ── POST /api/redeem ──────────────────────────────────────────────────────────
// Handles coupon code redemption via the DB `redeem_code` function.
// Referral codes are now handled client-side via `apply_referral_code` RPC,
// so this endpoint is primarily for coupon validation.
// Referral fallback is kept for older/other clients.
router.post("/redeem", async (req, res) => {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      res.status(500).json({ success: false, error: "server_error" });
      return;
    }

    // Fast JWT decode — no network call needed to get the user ID.
    const userId = extractUserId(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ success: false, error: "not_authenticated" });
      return;
    }

    const { code } = req.body as { code?: string };
    if (!code?.trim()) {
      res.status(400).json({ success: false, error: "Code is required" });
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    const admin = getAdminClient();

    // ── Step 1: Try as coupon ──────────────────────────────────────────────
    const { data: couponResult, error: couponErr } = await admin.rpc("redeem_code", {
      p_code:    cleanCode,
      p_user_id: userId,
    });

    if (couponErr) {
      console.error("[redeem] coupon RPC error:", couponErr.message);
      // Fall through to referral check
    } else if (couponResult?.success === true) {
      console.log(`[redeem] Coupon redeemed: ${cleanCode} by ${userId}`);
      res.json(couponResult);
      return;
    } else if (couponResult?.error && couponResult.error !== "not_a_coupon") {
      // Real coupon found but failed (already_used, exhausted, etc.)
      res.json({ success: false, error: couponResult.error });
      return;
    }

    // ── Step 2: Try as referral via single RPC call ────────────────────────
    // Uses process_referral_by_id() which handles everything in 1 SQL transaction:
    // find referrer → check duplicate → insert → award XP to both parties.
    const { data: refResult, error: refErr } = await admin.rpc("process_referral_by_id", {
      p_code:    cleanCode,
      p_user_id: userId,
    });

    if (refErr) {
      // Always fall back to the manual path — covers function-not-found and any other DB error
      console.warn("[redeem] process_referral_by_id failed, using legacy path:", refErr.message);
      return void await legacyReferral(admin, cleanCode, userId, res);
    }

    if (refResult?.success === true) {
      console.log(`[redeem] Referral success: ${cleanCode} by ${userId}`);
      res.json({ success: true, type: "referral", xp_bonus: refResult.xp_bonus ?? 100 });
    } else {
      res.json({ success: false, error: refResult?.error ?? "invalid_code" });
    }

  } catch (err: any) {
    console.error("[redeem] Unexpected error:", err?.message ?? err);
    res.status(500).json({ success: false, error: "Something went wrong" });
  }
});

// ── Legacy referral path (fallback if process_referral_by_id not yet deployed) ──
async function legacyReferral(
  admin: SupabaseClient,
  cleanCode: string,
  userId: string,
  res: import("express").Response,
) {
  const [referrerResult, existingResult] = await Promise.all([
    admin.from("profiles").select("id").eq("referral_code", cleanCode).maybeSingle(),
    admin.from("referrals").select("id").eq("referred_id", userId).maybeSingle(),
  ]);

  const referrer = referrerResult.data;
  if (!referrer) { res.json({ success: false, error: "invalid_code" }); return; }
  if (referrer.id === userId) { res.json({ success: false, error: "own_code" }); return; }
  if (existingResult.data) { res.json({ success: false, error: "already_used" }); return; }

  const { error: insertErr } = await admin.from("referrals").insert({
    referrer_id: referrer.id, referred_id: userId,
    code_used: cleanCode, xp_awarded_referrer: 500, xp_awarded_referred: 100,
  });

  if (insertErr) {
    if (insertErr.code === "23505") { res.json({ success: false, error: "already_used" }); }
    else { res.json({ success: false, error: "Failed to record referral" }); }
    return;
  }

  // Award XP both users in parallel using upsert+update
  await Promise.all([
    awardXpFast(admin, referrer.id, 500, "referral_friend_joined"),
    awardXpFast(admin, userId,      100, "referral_bonus"),
  ]);

  res.json({ success: true, type: "referral", xp_bonus: 100 });
}

// Atomic XP award: upsert-then-update to avoid a separate SELECT round-trip
async function awardXpFast(admin: SupabaseClient, uid: string, amount: number, reason: string) {
  // Ensure the row exists first
  await admin.from("user_xp").upsert(
    { user_id: uid, total_xp: 0, level: 1 },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
  // Then increment (single update — row is guaranteed to exist now)
  const { data: row } = await admin.from("user_xp").select("total_xp").eq("user_id", uid).single();
  const newTotal = (row?.total_xp ?? 0) + amount;
  await Promise.all([
    admin.from("user_xp").update({
      total_xp:   newTotal,
      level:      Math.max(1, Math.floor(newTotal / 500) + 1),
      updated_at: new Date().toISOString(),
    }).eq("user_id", uid),
    admin.from("daily_xp_log").insert({ user_id: uid, xp_amount: amount, reason }),
  ]);
}

export default router;
