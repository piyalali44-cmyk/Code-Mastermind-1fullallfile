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

async function verifyUser(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await getAdminClient().auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ── POST /api/redeem ──────────────────────────────────────────────────────────
// Unified code redemption: handles both referral codes and coupon codes.
// 1. First tries to redeem as a coupon code via DB function `redeem_code`
// 2. If not a coupon, tries as a referral code
router.post("/redeem", async (req, res) => {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      res.status(500).json({ success: false, error: "server_error" });
      return;
    }

    const user = await verifyUser(req.headers.authorization);
    if (!user) {
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

    // ── Step 1: Try redeem as coupon ──────────────────────────────────────────
    const { data: couponResult, error: couponErr } = await admin.rpc("redeem_code", {
      p_code:    cleanCode,
      p_user_id: user.id,
    });

    if (couponErr) {
      console.error("[redeem] coupon RPC error:", couponErr.message);
      // Fall through to referral check
    } else if (couponResult?.success === true) {
      console.log(`[redeem] Coupon redeemed: ${cleanCode} by ${user.id}`);
      res.json(couponResult);
      return;
    } else if (
      couponResult?.error &&
      couponResult.error !== "not_a_coupon"
    ) {
      // Real coupon found but redemption failed (already_used, exhausted, etc.)
      res.json({ success: false, error: couponResult.error });
      return;
    }

    // ── Step 2: Try as referral code ──────────────────────────────────────────
    const [referrerResult, existingResult] = await Promise.all([
      admin
        .from("profiles")
        .select("id, referral_code")
        .ilike("referral_code", cleanCode)
        .maybeSingle(),
      admin
        .from("referrals")
        .select("id")
        .eq("referred_id", user.id)
        .maybeSingle(),
    ]);

    const referrer = referrerResult.data;

    if (!referrer) {
      res.json({ success: false, error: "invalid_code" });
      return;
    }
    if (referrer.id === user.id) {
      res.json({ success: false, error: "own_code" });
      return;
    }
    if (existingResult.data) {
      res.json({ success: false, error: "already_used" });
      return;
    }

    // Record referral
    const { error: insertErr } = await admin.from("referrals").insert({
      referrer_id:         referrer.id,
      referred_id:         user.id,
      code_used:           cleanCode,
      xp_awarded_referrer: 500,
      xp_awarded_referred: 100,
    });

    if (insertErr) {
      console.error("[redeem] referral insert error:", insertErr.message);
      if (insertErr.code === "23505") {
        res.json({ success: false, error: "already_used" });
      } else {
        res.json({ success: false, error: "Failed to record referral" });
      }
      return;
    }

    // Ensure user_xp rows exist before updating
    await Promise.all([
      admin.from("user_xp").upsert(
        { user_id: referrer.id, total_xp: 0, level: 1 },
        { onConflict: "user_id", ignoreDuplicates: true }
      ),
      admin.from("user_xp").upsert(
        { user_id: user.id, total_xp: 0, level: 1 },
        { onConflict: "user_id", ignoreDuplicates: true }
      ),
    ]);

    // Award XP to both parties
    const updateXp = async (userId: string, amount: number, reason: string) => {
      const { data: row } = await admin
        .from("user_xp")
        .select("total_xp")
        .eq("user_id", userId)
        .single();
      const newTotal = (row?.total_xp ?? 0) + amount;
      const newLevel = Math.max(1, Math.floor(newTotal / 500) + 1);
      await Promise.all([
        admin.from("user_xp").update({
          total_xp:   newTotal,
          level:      newLevel,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId),
        admin.from("daily_xp_log").insert({ user_id: userId, xp_amount: amount, reason }),
      ]);
    };

    await Promise.all([
      updateXp(referrer.id, 500, "referral_friend_joined"),
      updateXp(user.id,     100, "referral_bonus"),
    ]);

    console.log(`[redeem] Referral success: ${cleanCode} — referrer ${referrer.id}, referred ${user.id}`);
    res.json({ success: true, type: "referral", xp_bonus: 100 });

  } catch (err: any) {
    console.error("[redeem] Unexpected error:", err?.message ?? err);
    res.status(500).json({ success: false, error: "Something went wrong" });
  }
});

export default router;
