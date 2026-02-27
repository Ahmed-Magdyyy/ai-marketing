import dotenv from "dotenv";
dotenv.config();

import { validateEnv } from "./shared/config/env";
import { createApp } from "./app";
import { connectDB } from "./shared/config/db";
import { logger } from "./shared/utils/logger";

// Validate environment variables before anything else
const env = validateEnv();

const app = createApp();

async function startServer(): Promise<void> {
  await connectDB();

  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
    logger.info(`Health check: http://localhost:${env.PORT}/api/health`);
  });
}

startServer().catch((error: unknown) => {
  logger.error("Failed to start server", { error });
  process.exit(1);
});

export { app };
