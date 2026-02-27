import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { pingRedis } from "../../shared/config/redis";
import { SWITCHES } from "../../shared/middleware/killSwitch.middleware";
import { KillSwitch } from "../../shared/types";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  let mongo = false;
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.command({ ping: 1 });
      mongo = true;
    }
  } catch (err) {
    mongo = false;
  }

  const redis = await pingRedis();

  const activeSwitches = Object.entries(SWITCHES)
    .filter(([_, isActive]) => isActive)
    .map(([key]) => key as KillSwitch);

  const status = mongo && redis ? "ok" : "degraded";

  res.status(200).json({ status, mongo, redis, activeSwitches });
});

export const healthRoutes = router;
