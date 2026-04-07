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

// Extended health check with schema status.
// Protected by a shared secret: pass ?key=<SUPABASE_SERVICE_ROLE_KEY> or use
// the Authorization: Bearer <service-role-key> header.
router.get("/health/schema", async (req, res) => {
  const authHeader = req.headers.authorization ?? "";
  const queryKey = req.query["key"] as string | undefined;
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

  const provided = authHeader.replace(/^Bearer\s+/i, "").trim() || queryKey || "";
  if (!serviceKey || provided !== serviceKey) {
    return res.status(401).json({ status: "unauthorized" });
  }

  try {
    const schema = await getSchemaStatus();
    res.json({
      status: schema.ok ? "ok" : "degraded",
      schema,
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

export default router;
