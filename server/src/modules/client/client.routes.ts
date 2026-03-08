import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { getProfile, updateProfile, deleteProfile } from "./client.controller";

const router = Router();

// Retrieve the authenticated user's profile
router.get("/profile", authMiddleware, getProfile);

// Update the authenticated user's profile
router.put("/profile", authMiddleware, updateProfile);

// Delete the authenticated user's profile
router.delete("/profile", authMiddleware, deleteProfile);

export default router;
