import { Router } from "express";
import { createBrand, updateBrand, getBrand } from "./brand.controller";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.post("/create", createBrand);
router.put("/:id", updateBrand);
router.get("/:id", getBrand);

export default router;
