// =========================================================================
// Fastify Server Entry — Phase 4: +video routes
// =========================================================================

import "./load-env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { projectRoutes } from "./routes/projects.js";
import { chatRoutes } from "./routes/chat.js";
import { storyboardRoutes } from "./routes/storyboard.js";
import { videoRoutes } from "./routes/video.js";
import { jobRoutes } from "./routes/jobs.js";
import { exportRoutes } from "./routes/export.js";
import { settingsRoutes } from "./routes/settings.js";
import { referenceAssetRoutes } from "./routes/referenceAssets.js";
import { startBackgroundPoller } from "./services/VideoService.js";

const PORT = parseInt(process.env.SERVER_PORT ?? "3001", 10);
const HOST = process.env.SERVER_HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });

// ---- Plugins -----------------------------------------------------------

await app.register(cors, {
  origin: (origin, cb) => {
    // Exact allowlist: Vite dev server + file:// (Origin: null) + same-origin (no Origin header)
    const allowed = new Set([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ]);
    if (!origin || origin === "null" || allowed.has(origin)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  methods: ["GET", "POST", "PATCH", "DELETE"],
});

await app.register(multipart, {
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
});

// ---- Routes ------------------------------------------------------------

await app.register(projectRoutes, { prefix: "/api" });
await app.register(chatRoutes, { prefix: "/api" });
await app.register(storyboardRoutes, { prefix: "/api" });
await app.register(videoRoutes, { prefix: "/api" });
await app.register(jobRoutes, { prefix: "/api" });
await app.register(exportRoutes, { prefix: "/api" });
await app.register(settingsRoutes, { prefix: "/api" });
await app.register(referenceAssetRoutes, { prefix: "/api" });

// ---- Health check ------------------------------------------------------

app.get("/api/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// ---- Start -------------------------------------------------------------

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`\n🔥 Server running at http://${HOST}:${PORT}`);
  console.log(`   Health: http://${HOST}:${PORT}/api/health\n`);

  // Start background video poller
  startBackgroundPoller();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
