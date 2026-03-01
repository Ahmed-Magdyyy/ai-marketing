import request from "supertest";
import { createApp } from "../src/app";
import { getReasoningModel } from "../src/shared/middleware/killSwitch.middleware";
import { getPlanLimits } from "../src/shared/config/planLimits";
import { PlanTier, ArabicDialect } from "../src/shared/types";

describe("Phase 1 Definition of Done Checks", () => {
  it("KILL_OPUS=true -> getReasoningModel() returns claude-sonnet-4-6", () => {
    let model: string = "";
    jest.isolateModules(() => {
      process.env.KILL_OPUS = "true";
      const {
        getReasoningModel,
      } = require("../src/shared/middleware/killSwitch.middleware");
      model = getReasoningModel();
      delete process.env.KILL_OPUS;
    });
    expect(model).toBe("claude-sonnet-4-6");
  });

  it("getPlanLimits(PlanTier.Free) and getPlanLimits(PlanTier.Starter) return without error", () => {
    expect(() => getPlanLimits(PlanTier.Free)).not.toThrow();
    expect(() => getPlanLimits(PlanTier.Starter)).not.toThrow();
  });

  it("ArabicDialect enum is defined and exported", () => {
    expect(ArabicDialect).toBeDefined();
    expect(ArabicDialect.Egyptian).toBe("egyptian");
    expect(ArabicDialect.Saudi).toBe("saudi");
  });

  it("all 5 rate limiters are configured and exported correctly", async () => {
    const {
      authLimiter,
      agentChatLimiter,
      contentGenerationLimiter,
      globalLimiter,
      fileUploadLimiter,
    } = await import("../src/shared/middleware/rateLimiter");

    expect(authLimiter).toBeDefined();
    expect(agentChatLimiter).toBeDefined();
    expect(contentGenerationLimiter).toBeDefined();
    expect(globalLimiter).toBeDefined();
    expect(fileUploadLimiter).toBeDefined();
  });
});
