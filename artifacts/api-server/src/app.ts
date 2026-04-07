import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Request logging ───────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Base patterns that allow localhost development and Replit-hosted previews.
// For production on any other host, add origins via the ALLOWED_ORIGINS env var.
const BASE_ORIGIN_PATTERNS: RegExp[] = [
  /\.replit\.dev$/,
  /\.replit\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

// ALLOWED_ORIGINS — comma-separated list of exact origins for production.
// Example: ALLOWED_ORIGINS=https://admin.example.com,https://app.example.com
// Set this environment variable to permit your production client origins.
const envOrigins: string[] =
  (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

if (process.env.NODE_ENV === "production" && envOrigins.length === 0) {
  logger.warn(
    "ALLOWED_ORIGINS is not set. " +
    "Set ALLOWED_ORIGINS to a comma-separated list of your production client origins.",
  );
}

function isOriginAllowed(origin: string): boolean {
  // Check exact matches from ALLOWED_ORIGINS env var
  if (envOrigins.includes(origin)) return true;
  // Check built-in patterns
  return BASE_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin header (e.g. mobile native, Postman, server-to-server).
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, isOriginAllowed(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-app-name"],
  }),
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  const message =
    err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});

export default app;
