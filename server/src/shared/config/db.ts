import mongoose from "mongoose";
import { logger } from "../utils/logger";

async function connectDB(): Promise<void> {
  const mongoUri: string = process.env.MONGODB_URI || "";

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  try {
    await mongoose.connect(mongoUri);
    logger.info("✅ MongoDB connected successfully");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`❌ MongoDB connection failed: ${message}`);

    process.exit(1);
  }
}

async function pingDB(): Promise<boolean> {
  try {
    if (!mongoose.connection.db) {
      return false;
    }
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}

export { connectDB, pingDB };
