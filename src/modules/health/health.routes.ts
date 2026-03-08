import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { pingRedis } from "../../shared/config/redis";
import { SWITCHES } from "../../shared/middleware/killSwitch.middleware";
import { KillSwitch } from "../../shared/types";
import { logger } from "../../shared/utils/logger";

const router = Router();

// ── Helper: check backing services ──────────────────────────────
async function checkMongo(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.command({ ping: 1 });
      return true;
    }
  } catch {
    /* swallow */
  }
  return false;
}

// ── GET /health — enriched overview ─────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  const mongo = await checkMongo();
  const redis = await pingRedis();

  const activeSwitches = Object.entries(SWITCHES)
    .filter(([_, isActive]) => isActive)
    .map(([key]) => key as KillSwitch);

  const status = mongo && redis ? "ok" : "degraded";

  if (status === "degraded") {
    import("../../shared/utils/alerting").then(({ sendAlert }) => {
      sendAlert("SystemDegraded", {
        severity: "CRITICAL",
        message: `Health check degraded! Mongo: ${mongo}, Redis: ${redis}`,
        context: { mongo, redis, activeSwitches },
      }).catch((err: unknown) =>
        logger.error("health_alert_send_failed", { error: err }),
      );
    });
  }

  const mem = process.memoryUsage();

  res.status(status === "ok" ? 200 : 503).json({
    status,
    version: process.env.npm_package_version || "1.0.0",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      rss: `${(mem.rss / 1024 / 1024).toFixed(1)}MB`,
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`,
    },
    mongo,
    redis,
    activeSwitches,
  });
});

// ── GET /health/ready — K8s readiness probe ─────────────────────
// Returns 200 only when both DB and Redis are available.
router.get("/ready", async (req: Request, res: Response) => {
  const mongo = await checkMongo();
  const redis = await pingRedis();

  if (mongo && redis) {
    res.status(200).json({ ready: true });
    return;
  }

  res.status(503).json({ ready: false, mongo, redis });
});

// ── GET /health/live — K8s liveness probe ───────────────────────
// Always returns 200 as long as the process is running.
router.get("/live", (req: Request, res: Response) => {
  res.status(200).json({ live: true });
});

export const healthRoutes = router;
