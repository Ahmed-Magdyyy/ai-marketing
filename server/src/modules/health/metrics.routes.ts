import { Router, Request, Response } from "express";
import { metrics } from "../../shared/utils/metrics";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.set("Content-Type", "text/plain");
  return res.status(200).send(metrics.format());
});

export { router as metricsRoutes };
