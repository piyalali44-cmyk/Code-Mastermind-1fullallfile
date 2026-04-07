import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getSchemaStatus } from "../lib/supabaseMigrations";

const router: IRouter = Router();

// Both /api/healthz and /api/health are supported.
// /api/healthz is the original path; /api/health is the canonical alias.
router.get(["/healthz", "/health"], (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Extended health check with schema status — admin use only
router.get("/health/schema", async (_req, res) => {
  try {
    const schema = await getSchemaStatus();
    res.json({
      status: schema.ok ? "ok" : "degraded",
      schema,
      supabase: {
        url: process.env["SUPABASE_URL"] ?? "https://tkruzfskhtcazjxdracm.supabase.co",
        hasAnonKey: !!process.env["SUPABASE_ANON_KEY"],
        hasServiceKey: !!process.env["SUPABASE_SERVICE_ROLE_KEY"],
        hasAccessToken: !!process.env["SUPABASE_ACCESS_TOKEN"],
      },
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

export default router;
