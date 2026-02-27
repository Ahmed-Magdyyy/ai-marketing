import request from "supertest";
import { createApp } from "../src/app";
import { getRedisClient } from "../src/shared/config/redis";
import { UserModel as User } from "../src/modules/auth/user.model";

const app = createApp();
const redis = getRedisClient();

describe("Auth Endpoints API Test", () => {
  beforeEach(async () => {
    // Clear the database and redis before each test to ensure isolation
    await User.deleteMany({});
    await redis.flushall();
  });

  const validUser = {
    name: "John Doe",
    email: "john@example.com",
    password: "Password123!",
  };

  it("should register a new user successfully", async () => {
    const res = await request(app).post("/api/auth/register").send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(res.body.data.accessToken).toBeDefined();

    // Check if the refresh token is stored in cookie
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toContain("refreshToken=");
  });

  it("should fail to register with an existing email", async () => {
    await request(app).post("/api/auth/register").send(validUser);

    const res = await request(app).post("/api/auth/register").send(validUser);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("should login successfully and return tokens", async () => {
    const regRes = await request(app)
      .post("/api/auth/register")
      .send(validUser);
    expect(regRes.status).toBe(201); // Ensure register actually succeeds first

    const res = await request(app).post("/api/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers["set-cookie"][0]).toContain("refreshToken=");
  });

  it("should reject login with wrong password", async () => {
    await request(app).post("/api/auth/register").send(validUser);

    const res = await request(app).post("/api/auth/login").send({
      email: validUser.email,
      password: "WrongPassword123!",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
