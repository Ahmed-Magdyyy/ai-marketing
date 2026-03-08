module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  setupFiles: ["dotenv/config"],
  moduleNameMapper: {
    "^ioredis$": "ioredis-mock",
  },
};
