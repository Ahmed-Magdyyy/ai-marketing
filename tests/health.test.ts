import request from "supertest";
import { createApp } from "../src/app";

describe("Health Route", () => {
  it("should return public health info", async () => {
    const app = createApp();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
  });
});
