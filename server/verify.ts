import { getReasoningModel } from "./src/shared/middleware/killSwitch.middleware";
import { getPlanLimits } from "./src/shared/config/planLimits";
import { PlanTier, ArabicDialect } from "./src/shared/types";
import { fileUploadLimiter } from "./src/shared/middleware/rateLimiter";
import { createApp } from "./src/app";
import request from "supertest";
import mongoose from "mongoose";

async function runChecks() {
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "secret";
  process.env.JWT_REFRESH_SECRET = "secret";

  console.log("Checking Opus kill switch...");
  process.env.KILL_OPUS = "true";
  const model = getReasoningModel();
  if (model !== "claude-sonnet-4-6") {
    throw new Error(`Expected claude-sonnet-4-6, got ${model}`);
  }
  console.log("Opus kill switch OK!");

  console.log("Checking Plan Limits...");
  getPlanLimits(PlanTier.FREE);
  getPlanLimits(PlanTier.STARTER);
  console.log("Plan Limits OK!");

  console.log("Checking exports...");
  if (!ArabicDialect) throw new Error("ArabicDialect missing");
  if (!fileUploadLimiter) throw new Error("fileUploadLimiter missing");
  console.log("Exports OK!");

  console.log("Checking API Rate Limits for /api/auth/login...");
  const app = createApp();

  // We loop 12 times to make sure we hit the 429
  // The global auth limit is usually set. Let's send a fake login payload.
  let limitHit = false;
  let successCount = 0;
  for (let i = 0; i < 12; i++) {
    const res = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "wrong", // doesn't matter, we want to hit the rate limiter before db checks
    });
    if (res.status === 429) {
      limitHit = true;
      console.log(`Hit 429 on request #${i + 1}`);
      break;
    } else {
      successCount++;
    }
  }

  if (!limitHit) {
    throw new Error("Did not hit rate limit!");
  }
  console.log(
    `Rate Limiting OK! (Got ${successCount} requests through before 429)`,
  );

  console.log("All verify checks passed!");
}

runChecks()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
