import { Router, type IRouter } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const SUPABASE_URL = "https://tkruzfskhtcazjxdracm.supabase.co";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

// Google Play / Apple store credentials (set as environment variables)
const GOOGLE_PLAY_PACKAGE   = process.env["GOOGLE_PLAY_PACKAGE_NAME"] ?? "";
const GOOGLE_SERVICE_ACCOUNT = process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] ?? "";
const APPLE_SHARED_SECRET   = process.env["APPLE_SHARED_SECRET"] ?? "";
const APPLE_BUNDLE_ID       = process.env["APPLE_BUNDLE_ID"] ?? "";

let _adminClient: SupabaseClient | null = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _adminClient;
}

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

// Plan duration in days
function planDays(plan: string): number {
  if (plan === "weekly")   return 7;
  if (plan === "monthly")  return 30;
  if (plan === "lifetime") return 0;
  return 30;
}

// ── Verify Google Play receipt ────────────────────────────────────────────────
async function verifyGooglePlayPurchase(
  productId: string,
  purchaseToken: string,
): Promise<{ valid: boolean; expiresAt: Date | null; orderId?: string }> {
  if (!GOOGLE_SERVICE_ACCOUNT) {
    // Store not yet configured — reject
    return { valid: false, expiresAt: null };
  }
  try {
    const { google } = await import("googleapis");
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT),
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const androidpublisher = google.androidpublisher({ version: "v3", auth });
    const result = await androidpublisher.purchases.subscriptions.get({
      packageName:   GOOGLE_PLAY_PACKAGE,
      subscriptionId: productId,
      token:         purchaseToken,
    });
    const data = result.data;
    const expiryMs = parseInt(data.expiryTimeMillis ?? "0", 10);
    const valid = data.cancelReason === undefined && expiryMs > Date.now();
    return {
      valid,
      expiresAt: expiryMs ? new Date(expiryMs) : null,
      orderId:   data.orderId ?? undefined,
    };
  } catch (err: any) {
    console.error("[subscription] Google Play verify error:", err?.message);
    return { valid: false, expiresAt: null };
  }
}

// ── Verify Apple App Store receipt ────────────────────────────────────────────
async function verifyApplePurchase(
  receiptData: string,
  transactionId?: string,
): Promise<{ valid: boolean; expiresAt: Date | null; originalTransactionId?: string }> {
  if (!APPLE_SHARED_SECRET) {
    return { valid: false, expiresAt: null };
  }
  // Try production first, then sandbox
  const endpoints = [
    "https://buy.itunes.apple.com/verifyReceipt",
    "https://sandbox.itunes.apple.com/verifyReceipt",
  ];
  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "receipt-data":   receiptData,
          "password":       APPLE_SHARED_SECRET,
          "exclude-old-transactions": true,
        }),
      });
      const data: any = await resp.json();
      if (data.status === 21007) continue; // Sandbox receipt — try next
      if (data.status !== 0) {
        console.warn("[subscription] Apple verify status:", data.status);
        return { valid: false, expiresAt: null };
      }
      const latestReceipts: any[] = data.latest_receipt_info ?? [];
      if (latestReceipts.length === 0) return { valid: false, expiresAt: null };
      // Sort by expiry — latest first
      latestReceipts.sort((a, b) =>
        parseInt(b.expires_date_ms, 10) - parseInt(a.expires_date_ms, 10));
      const latest = latestReceipts[0];
      const expiryMs = parseInt(latest.expires_date_ms, 10);
      const valid = expiryMs > Date.now();
      return {
        valid,
        expiresAt: new Date(expiryMs),
        originalTransactionId: latest.original_transaction_id,
      };
    } catch (err: any) {
      console.error("[subscription] Apple verify error:", err?.message);
    }
  }
  return { valid: false, expiresAt: null };
}

// ── POST /api/subscription/verify ────────────────────────────────────────────
// Called by mobile app after purchase is completed on device
router.post("/subscription/verify", async (req, res) => {
  try {
    const userId = extractUserId(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ success: false, error: "not_authenticated" });
      return;
    }

    const {
      store,           // "google_play" | "app_store"
      productId,       // "premium_weekly" | "premium_monthly"
      purchaseToken,   // Google Play token
      receiptData,     // Apple receipt base64
      transactionId,   // Apple transaction ID
    } = req.body as {
      store: string;
      productId: string;
      purchaseToken?: string;
      receiptData?: string;
      transactionId?: string;
    };

    if (!store || !productId) {
      res.status(400).json({ success: false, error: "store and productId are required" });
      return;
    }

    const admin = getAdminClient();
    const plan = productId.includes("weekly") ? "weekly" : "monthly";

    // Log the initiation
    await admin.from("purchase_events").insert({
      user_id:        userId,
      event_type:     "purchase_initiated",
      plan,
      store,
      product_id:     productId,
      purchase_token: purchaseToken ?? null,
      original_transaction_id: transactionId ?? null,
    });

    let verified = false;
    let expiresAt: Date | null = null;
    let originalTransactionId: string | undefined = transactionId;

    if (store === "google_play" && purchaseToken) {
      const result = await verifyGooglePlayPurchase(productId, purchaseToken);
      verified               = result.valid;
      expiresAt              = result.expiresAt;
      originalTransactionId  = result.orderId ?? transactionId;
    } else if (store === "app_store" && receiptData) {
      const result = await verifyApplePurchase(receiptData, transactionId);
      verified               = result.valid;
      expiresAt              = result.expiresAt;
      originalTransactionId  = result.originalTransactionId ?? transactionId;
    } else {
      // Store credentials not yet configured — allow for testing
      // In production, remove this fallback and reject unverified purchases
      if (process.env["NODE_ENV"] !== "production") {
        verified  = true;
        expiresAt = new Date(Date.now() + planDays(plan) * 86400 * 1000);
        console.warn("[subscription] STORE NOT CONFIGURED — granting in dev mode only");
      }
    }

    if (!verified) {
      await admin.from("purchase_events").insert({
        user_id:    userId,
        event_type: "purchase_failed",
        plan, store,
        product_id:     productId,
        error_message:  "Receipt verification failed",
      });
      res.status(400).json({ success: false, error: "receipt_invalid" });
      return;
    }

    // Record the verified purchase in DB
    const { data, error } = await admin.rpc("record_verified_purchase", {
      p_user_id:                  userId,
      p_plan:                     plan,
      p_store:                    store,
      p_product_id:               productId,
      p_purchase_token:           purchaseToken ?? null,
      p_original_transaction_id:  originalTransactionId ?? null,
      p_expires_at:               expiresAt?.toISOString() ?? null,
      p_amount_usd:               null,
    });

    if (error) {
      console.error("[subscription] record_verified_purchase error:", error.message);
      res.status(500).json({ success: false, error: "db_error" });
      return;
    }

    res.json(data ?? { success: true, plan, expires_at: expiresAt, is_premium: true });
  } catch (err: any) {
    console.error("[subscription] verify unexpected error:", err?.message);
    res.status(500).json({ success: false, error: "internal_error" });
  }
});

// ── POST /api/subscription/restore ───────────────────────────────────────────
// Called by mobile app when user taps "Restore Purchases"
router.post("/subscription/restore", async (req, res) => {
  try {
    const userId = extractUserId(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ success: false, error: "not_authenticated" });
      return;
    }

    const { store, purchaseToken, receiptData, transactionId } = req.body as {
      store?: string;
      purchaseToken?: string;
      receiptData?: string;
      transactionId?: string;
    };

    const admin = getAdminClient();

    // First, check existing active subscription in DB
    const { data: existing } = await admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.status === "active" && (!existing.expires_at || new Date(existing.expires_at) > new Date())) {
      // Already active — just ensure profile is synced
      await admin
        .from("profiles")
        .update({ subscription_tier: "premium", subscription_expires_at: existing.expires_at })
        .eq("id", userId);

      await admin.from("purchase_events").insert({
        user_id: userId, event_type: "restore_success",
        plan: existing.plan, store: existing.store ?? "manual",
      });

      res.json({ success: true, restored: true, plan: existing.plan, expires_at: existing.expires_at, is_premium: true });
      return;
    }

    // No active local record — try to verify with store
    let verified = false;
    let expiresAt: Date | null = null;
    let originalTransactionId = transactionId;
    let plan = existing?.plan ?? "monthly";

    if (store === "google_play" && purchaseToken) {
      const result = await verifyGooglePlayPurchase(existing?.product_id ?? "premium_monthly", purchaseToken);
      verified              = result.valid;
      expiresAt             = result.expiresAt;
      originalTransactionId = result.orderId;
    } else if (store === "app_store" && receiptData) {
      const result = await verifyApplePurchase(receiptData);
      verified              = result.valid;
      expiresAt             = result.expiresAt;
      originalTransactionId = result.originalTransactionId;
    }

    if (!verified) {
      await admin.from("purchase_events").insert({
        user_id: userId, event_type: "restore_failed",
        store: store ?? "unknown",
        error_message: "No active purchase found to restore",
      });
      res.json({ success: false, error: "no_active_purchase" });
      return;
    }

    // Re-activate
    const { data } = await admin.rpc("record_verified_purchase", {
      p_user_id:                 userId,
      p_plan:                    plan,
      p_store:                   store ?? "manual",
      p_product_id:              existing?.product_id ?? "",
      p_purchase_token:          purchaseToken ?? null,
      p_original_transaction_id: originalTransactionId ?? null,
      p_expires_at:              expiresAt?.toISOString() ?? null,
      p_amount_usd:              null,
    });

    await admin.from("purchase_events").insert({
      user_id: userId, event_type: "restore_success", plan, store: store ?? "manual",
    });

    res.json(data ?? { success: true, restored: true, plan, expires_at: expiresAt, is_premium: true });
  } catch (err: any) {
    console.error("[subscription] restore unexpected error:", err?.message);
    res.status(500).json({ success: false, error: "internal_error" });
  }
});

// ── GET /api/subscription/status ─────────────────────────────────────────────
// Returns current subscription status for the authenticated user
router.get("/subscription/status", async (req, res) => {
  try {
    const userId = extractUserId(req.headers.authorization);
    if (!userId) {
      res.status(401).json({ success: false, error: "not_authenticated" });
      return;
    }
    const admin = getAdminClient();

    const [subResult, profileResult] = await Promise.all([
      admin.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("profiles").select("subscription_tier, subscription_expires_at").eq("id", userId).maybeSingle(),
    ]);

    const sub     = subResult.data;
    const profile = profileResult.data;

    // Check if active subscription has expired
    if (sub?.status === "active" && sub.expires_at && new Date(sub.expires_at) < new Date()) {
      await admin.from("subscriptions").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", userId);
      await admin.from("profiles").update({ subscription_tier: "free", subscription_expires_at: null }).eq("id", userId);

      res.json({ is_premium: false, status: "expired", plan: sub.plan, expires_at: sub.expires_at });
      return;
    }

    const isPremium = profile?.subscription_tier === "premium"
      || (sub?.status === "active" && (!sub.expires_at || new Date(sub.expires_at) > new Date()));

    res.json({
      is_premium:   isPremium,
      status:       sub?.status ?? "none",
      plan:         sub?.plan ?? null,
      expires_at:   sub?.expires_at ?? null,
      store:        sub?.store ?? null,
      auto_renew:   sub?.auto_renew ?? false,
    });
  } catch (err: any) {
    console.error("[subscription] status unexpected error:", err?.message);
    res.status(500).json({ success: false, error: "internal_error" });
  }
});

export default router;
