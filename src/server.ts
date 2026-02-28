import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import { Server } from "socket.io";
import { validateEnv } from "./shared/config/env";
import { createApp } from "./app";
import { connectDB } from "./shared/config/db";
import { logger } from "./shared/utils/logger";
import { setIO } from "./shared/utils/socketProvider";

// Validate environment variables before anything else
const env = validateEnv();

const app = createApp();
const httpServer = createServer(app);

// Initialize Socket.io with the same CORS settings as Express
const io = new Server(httpServer, {
  cors: {
    origin: env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
  },
});

setIO(io);

io.on("connection", (socket) => {
  logger.info(`Client connected via Socket.io: ${socket.id}`);

  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

async function startServer(): Promise<void> {
  await connectDB();

  httpServer.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
    logger.info(`Health check: http://localhost:${env.PORT}/api/health`);
    logger.info("Socket.io server started");
  });
}

startServer().catch((error: unknown) => {
  logger.error("Failed to start server", { error });
  process.exit(1);
});

export { app };
