// ─────────────────────────────────────────────────────────────────
// Billing Routes — Phase 9: Paymob Billing & Subscriptions
// POST /api/billing/checkout  — create Paymob checkout session
// POST /api/billing/webhook   — handle Paymob payment webhook (public)
// GET  /api/billing/usage     — current usage vs limits dashboard
// POST /api/billing/cancel    — cancel active subscription
// ─────────────────────────────────────────────────────────────────

import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { killSwitch } from "../../shared/middleware/killSwitch.middleware";
import { checkout, webhook, usage, cancel } from "./billing.controller";

const router = Router();

// ── Public routes (no auth) ──────────────────────────────────────

// Paymob webhook — no auth, verified via HMAC
router.post("/webhook", webhook);

// ── Authenticated routes ─────────────────────────────────────────

router.use(authMiddleware);

// Create checkout session — requires payment gateway to be enabled
router.post("/checkout", killSwitch("DISABLE_PAYMENT_GATEWAYS"), checkout);

// Get usage summary — always available (read-only)
router.get("/usage", usage);

// Cancel subscription — requires subscription management to be enabled
router.post("/cancel", killSwitch("DISABLE_SUBSCRIPTION_MANAGEMENT"), cancel);

export default router;
