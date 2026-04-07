/**
 * StayGuided Admin Panel — Standalone Server
 * 
 * Zero external dependencies — uses only Node.js built-ins.
 * Serves the pre-built static files in ./dist/
 * Falls back to index.html for client-side routing (SPA).
 * 
 * Usage:  node server.js
 * Port:   Set PORT env var (default: 3000)
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = path.join(__dirname, "dist");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".eot":  "font/eot",
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { "Content-Type": mime });
  stream.pipe(res);
  stream.on("error", () => {
    res.writeHead(500);
    res.end("Internal server error");
  });
}

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];

  // Normalize to remove trailing slash (except root)
  if (urlPath !== "/" && urlPath.endsWith("/")) {
    urlPath = urlPath.slice(0, -1);
  }

  const filePath = path.join(DIST_DIR, urlPath);

  // Prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      serveFile(res, filePath);
    } else if (!err && stat.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      fs.stat(indexPath, (err2) => {
        if (!err2) serveFile(res, indexPath);
        else serveFile(res, path.join(DIST_DIR, "index.html")); // SPA fallback
      });
    } else {
      // SPA fallback — serve index.html for all unknown routes
      serveFile(res, path.join(DIST_DIR, "index.html"));
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ StayGuided Admin Panel running on http://0.0.0.0:${PORT}`);
});
