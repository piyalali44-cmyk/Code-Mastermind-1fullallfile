import { Router, type IRouter } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const SUPABASE_URL = "https://tkruzfskhtcazjxdracm.supabase.co";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const SUPABASE_ANON_KEY = process.env["SUPABASE_ANON_KEY"] ?? SUPABASE_SERVICE_KEY;

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
  const admin = getAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

router.post("/referral/apply", async (req, res) => {
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
    const referredId = user.id;
    const admin = getAdminClient();

    const [referrerResult, existingResult] = await Promise.all([
      admin
        .from("profiles")
        .select("id, referral_code")
        .ilike("referral_code", cleanCode)
        .maybeSingle(),
      admin
        .from("referrals")
        .select("id")
        .eq("referred_id", referredId)
        .maybeSingle(),
    ]);

    const referrer = referrerResult.data;
    if (!referrer) {
      res.json({ success: false, error: "invalid_code" });
      return;
    }

    if (referrer.id === referredId) {
      res.json({ success: false, error: "own_code" });
      return;
    }

    if (existingResult.data) {
      res.json({ success: false, error: "already_used" });
      return;
    }

    const { error: insertErr } = await admin.from("referrals").insert({
      referrer_id: referrer.id,
      referred_id: referredId,
      code_used: cleanCode,
      xp_awarded_referrer: 500,
      xp_awarded_referred: 100,
    });

    if (insertErr) {
      console.error("[referral] Insert error:", insertErr.message);
      if (insertErr.message?.includes("duplicate") || insertErr.code === "23505") {
        res.json({ success: false, error: "already_used" });
      } else {
        res.json({ success: false, error: "Failed to record referral" });
      }
      return;
    }

    await Promise.all([
      admin.from("user_xp").upsert(
        { user_id: referrer.id, total_xp: 0, level: 1 },
        { onConflict: "user_id", ignoreDuplicates: true }
      ),
      admin.from("user_xp").upsert(
        { user_id: referredId, total_xp: 0, level: 1 },
        { onConflict: "user_id", ignoreDuplicates: true }
      ),
    ]);

    const updateXp = async (userId: string, amount: number, reason: string) => {
      const { data: row } = await admin.from("user_xp").select("total_xp").eq("user_id", userId).single();
      const currentXp = (row?.total_xp ?? 0) + amount;
      const newLevel = Math.floor(currentXp / 500) + 1;
      await Promise.all([
        admin.from("user_xp").update({
          total_xp: currentXp,
          level: newLevel,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId),
        admin.from("daily_xp_log").insert({ user_id: userId, xp_amount: amount, reason }),
      ]);
    };

    await Promise.all([
      updateXp(referrer.id, 500, "referral_friend_joined"),
      updateXp(referredId, 100, "referral_bonus"),
    ]);

    res.json({ success: true, xp_bonus: 100 });
  } catch (err: any) {
    console.error("[referral] Unexpected error:", err?.message ?? err);
    res.status(500).json({ success: false, error: "Something went wrong" });
  }
});

export default router;
