import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { globalLimiter, authLimiter } from "./shared/middleware/rateLimiter";
import {
  errorHandler,
  notFoundHandler,
} from "./shared/middleware/error.middleware";
import authRoutes from "./modules/auth/auth.routes";
import { healthRoutes } from "./modules/health/health.routes";
import clientRoutes from "./modules/client/client.routes";
import brandRoutes from "./modules/brand/brand.routes";
import { uploadRouter } from "./modules/upload/upload.routes";
import agentRoutes from "./modules/agent/agent.routes";
import adminRoutes from "./modules/admin/admin.routes";
import researchRoutes from "./modules/research/research.routes";
import planRoutes from "./modules/plan/plan.routes";
import socialRoutes from "./modules/social/social.routes";

function createApp(): Application {
  const app: Application = express();

  // ── Security ────────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3001",
      credentials: true,
    }),
  );

  // ── Body Parsing ────────────────────────────────────────────────
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ── Global Rate Limit ───────────────────────────────────────────
  app.use(globalLimiter);

  // ── Routes ──────────────────────────────────────────────────────
  app.use("/api/health", healthRoutes);
  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api", clientRoutes);
  app.use("/api/brand", brandRoutes);
  app.use("/api/upload", uploadRouter);
  app.use("/api/agent", agentRoutes);
  app.use("/api/research", researchRoutes);
  app.use("/api/plan", planRoutes);
  app.use("/api/social", socialRoutes);
  app.use("/api/admin", adminRoutes);

  // ── 404 + Error Handler ─────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export { createApp };
