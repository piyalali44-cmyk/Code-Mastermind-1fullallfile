#!/usr/bin/env node
/**
 * fix-supabase-email-template.mjs
 *
 * Updates the Supabase "Reset Password" email template to send a 6-digit OTP
 * code ({{ .Token }}) instead of a magic link ({{ .ConfirmationURL }}).
 *
 * USAGE:
 *   node scripts/fix-supabase-email-template.mjs YOUR_SUPABASE_ACCESS_TOKEN
 *
 * How to get your access token:
 *   1. Go to https://supabase.com
 *   2. Click your avatar (top-right) → Account → Access Tokens
 *   3. Click "Generate new token", give it any name, copy it
 *   4. Paste it as the argument above
 */

const PROJECT_REF = "tkruzfskhtcazjxdracm";

const accessToken = process.argv[2];

if (!accessToken) {
  console.error("\n❌  No access token provided.\n");
  console.error("Usage: node scripts/fix-supabase-email-template.mjs YOUR_ACCESS_TOKEN\n");
  console.error("Get your token from: https://supabase.com → avatar → Account → Access Tokens\n");
  process.exit(1);
}

const RECOVERY_BODY = `<h2>Reset your password</h2>
<p>Hi,</p>
<p>You requested a password reset for your <strong>StayGuided Me</strong> account.</p>
<p>Enter this code in the app:</p>
<div style="text-align:center;margin:30px 0;">
  <span style="letter-spacing:10px;font-size:42px;font-weight:700;color:#B8963E;background:#f9f4ee;border-radius:12px;padding:16px 28px;">{{ .Token }}</span>
</div>
<p style="color:#666;font-size:14px;">This code expires in <strong>60 minutes</strong>.</p>
<p style="color:#666;font-size:14px;">If you did not request this, you can safely ignore this email.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
<p style="font-size:12px;color:#999;text-align:center;">StayGuided Me</p>`;

async function updateTemplate() {
  console.log(`\n🔧  Updating Supabase Reset Password email template...`);
  console.log(`    Project: ${PROJECT_REF}\n`);

  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mailer_templates_recovery_content: RECOVERY_BODY,
      mailer_subjects_recovery: "Your StayGuided Me password reset code",
      mailer_otp_length: 6,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error(`❌  API call failed (HTTP ${res.status}):\n`);
    try {
      console.error(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.error(text);
    }
    process.exit(1);
  }

  const json = JSON.parse(text);
  console.log("✅  Done!\n");
  console.log("• OTP length set to:", json.mailer_otp_length, "digits");
  console.log("• Subject:", json.mailer_subjects_recovery);
  console.log("• Template updated: {{ .Token }} shown as plain text code\n");
  console.log("Verify at: https://supabase.com/dashboard/project/" + PROJECT_REF + "/auth/templates\n");
}

updateTemplate().catch((err) => {
  console.error("❌  Unexpected error:", err.message);
  process.exit(1);
});
