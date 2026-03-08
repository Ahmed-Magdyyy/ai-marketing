import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongoServer: MongoMemoryServer;

// Set required environment variables for tests
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "secret";
process.env.JWT_REFRESH_SECRET = "secret";

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Set the environment variable for any code that reads it directly
  process.env.MONGODB_URI = mongoUri;

  // Connect globally so that routes importing models don't buffer indefinitely
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
