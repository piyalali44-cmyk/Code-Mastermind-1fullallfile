import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "https://tkruzfskhtcazjxdracm.supabase.co";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── POST /contact ────────────────────────────────────────────────────────
router.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message, userId } = req.body as {
      name?: string; email?: string; subject?: string; message?: string; userId?: string;
    };

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      res.status(400).json({ error: "All fields (name, email, subject, message) are required" });
      return;
    }
    if (!SUPABASE_SERVICE_KEY) { res.status(500).json({ error: "Server misconfiguration" }); return; }

    const admin = getAdminClient();
    const { error } = await admin.from("admin_activity_log").insert({
      action: `Contact: ${subject.trim()}`,
      entity_type: "contact_message",
      entity_id: null,
      admin_id: null,
      details: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
        user_id: userId ?? null,
        status: "unread",
        replied: false,
      },
    });

    if (error) { console.error("[contact]", error.message); res.status(500).json({ error: "Failed to store message" }); return; }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

// ─── POST /contact/reply ─────────────────────────────────────────────────
// Admin replies to a contact message.
// Sends a push notification to the specific user only (if they have a token),
// updates the DB record, and returns whether push was delivered.
// Protected: requires admin/super_admin auth via Bearer token.
router.post("/contact/reply", async (req, res) => {
  try {
    if (!SUPABASE_SERVICE_KEY) { res.status(500).json({ error: "Server misconfiguration" }); return; }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) { res.status(401).json({ error: "Authentication required" }); return; }

    const admin = getAdminClient();
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller) { res.status(401).json({ error: "Invalid token" }); return; }

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();
    const role = callerProfile?.role;
    if (!role || !["super_admin", "admin", "editor"].includes(role)) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const { messageId, replyText, userId, userEmail, userName, subject } = req.body as {
      messageId?: string;
      replyText?: string;
      userId?: string | null;
      userEmail?: string;
      userName?: string;
      subject?: string;
    };

    if (!messageId || !replyText?.trim()) {
      res.status(400).json({ error: "messageId and replyText are required" });
      return;
    }

    // ── 1. Look up push token for this user ──────────────────────────────
    let pushToken: string | null = null;
    if (userId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("push_token")
        .eq("id", userId)
        .single();
      pushToken = profile?.push_token ?? null;
    }

    // ── 2. Send push notification to THIS USER ONLY ──────────────────────
    let pushSent = false;
    const notifTitle = "Reply from StayGuided Me";
    const notifBody = replyText.trim().slice(0, 150) + (replyText.trim().length > 150 ? "…" : "");

    if (pushToken) {
      try {
        const pushRes = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            to: pushToken,
            title: notifTitle,
            body: notifBody,
            sound: "default",
            data: { url: "stayguided://screen/profile", type: "contact_reply" },
          }),
        });
        const pushJson = (await pushRes.json()) as any;
        const ticket = pushJson?.data;
        pushSent = ticket?.status === "ok";
      } catch (pushErr: any) {
        console.warn("[contact/reply] push failed:", pushErr?.message);
      }
    }

    // ── 3. Save notification record for in-app inbox (always, regardless of push token) ──
    if (userId) {
      try {
        await admin.from("notifications").insert({
          user_id: userId,
          title: notifTitle,
          body: notifBody,
          type: "contact_reply",
          action_type: "contact_reply",
          action_payload: { type: "contact_reply", message_id: messageId },
          is_read: false,
        });
      } catch (e: any) {
        console.warn("[contact/reply] notification insert failed:", e?.message);
      }
    }

    // ── 4. Update the admin_activity_log record ──────────────────────────
    const { data: existing } = await admin
      .from("admin_activity_log")
      .select("details")
      .eq("id", messageId)
      .single();

    if (existing) {
      const newDetails = {
        ...existing.details,
        replied: true,
        status: "replied",
        reply_text: replyText.trim(),
        replied_at: new Date().toISOString(),
        push_sent: pushSent,
      };
      await admin.from("admin_activity_log").update({ details: newDetails }).eq("id", messageId);
    }

    res.json({ ok: true, pushSent, hasPushToken: !!pushToken });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

export default router;
