interface EnvConfig {
  // Server
  PORT: number;
  NODE_ENV: string;

  // MongoDB
  MONGODB_URI: string;

  // JWT
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;

  // Redis
  REDIS_URL: string;

  // AI — Anthropic
  ANTHROPIC_API_KEY: string;

  // AI — OpenAI
  OPENAI_API_KEY: string;

  // Scrapling
  SCRAPER_SERVICE_URL: string;

  // Security
  TOKEN_ENCRYPTION_KEY: string;
  TOKEN_ENCRYPTION_KEY_PREV: string;

  // Kill Switches
  KILL_DEEP_RESEARCH: boolean;
  KILL_OPUS: boolean;
  KILL_VIDEO: boolean;
  KILL_VOICEOVER: boolean;
  KILL_CONTENT: boolean;
  KILL_ALL: boolean;

  // App
  FRONTEND_URL: string;
}

function validateEnv(): EnvConfig {
  const required: string[] = [
    "MONGODB_URI",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "REDIS_URL",
  ];

  const missing: string[] = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join("\n")}`,
    );
  }

  return {
    // Server
    PORT: parseInt(process.env.PORT || "3000", 10),
    NODE_ENV: process.env.NODE_ENV || "development",

    // MongoDB
    MONGODB_URI: process.env.MONGODB_URI!,

    // JWT
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

    // Redis
    REDIS_URL: process.env.REDIS_URL!,

    // AI — Anthropic (not required in Phase 1, but validated when present)
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",

    // AI — OpenAI (not required in Phase 1)
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",

    // Scrapling
    SCRAPER_SERVICE_URL:
      process.env.SCRAPER_SERVICE_URL || "http://localhost:8000",

    // Security
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY || "",
    TOKEN_ENCRYPTION_KEY_PREV: process.env.TOKEN_ENCRYPTION_KEY_PREV || "",

    // Kill Switches
    KILL_DEEP_RESEARCH: process.env.KILL_DEEP_RESEARCH === "true",
    KILL_OPUS: process.env.KILL_OPUS === "true",
    KILL_VIDEO: process.env.KILL_VIDEO === "true",
    KILL_VOICEOVER: process.env.KILL_VOICEOVER === "true",
    KILL_CONTENT: process.env.KILL_CONTENT === "true",
    KILL_ALL: process.env.KILL_ALL === "true",

    // App
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3001",
  };
}

export { EnvConfig, validateEnv };
