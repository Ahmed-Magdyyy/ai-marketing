// ─────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for all AI models, providers, and clients.
// To swap a model: set the corresponding MODEL_* env variable.
// To swap a provider: update the client and model string together.
// Never reference model strings or API clients anywhere else.
// ─────────────────────────────────────────────────────────────────

import { ModelRole } from "../types";

// ── Model Defaults ────────────────────────────────────────────────
// Each entry: ENV override takes priority, then falls back to default.
// To swap: set MODEL_<ROLE>=<new-model-string> in .env and restart.
const MODELS: Record<ModelRole, string> = {
  // ── Language Models (Anthropic Claude) ──
  [ModelRole.AGENT_REASONING]:
    process.env.MODEL_AGENT_REASONING || "claude-opus-4-6",
  // Used for: competitor analysis, brand DNA, strategy generation, marketing plans
  // Swap trigger: Anthropic releases better/cheaper model, or cost needs reduction

  [ModelRole.AGENT_FAST]: process.env.MODEL_AGENT_FAST || "claude-sonnet-4-6",
  // Used for: captions, quick chat replies, reformatting, summarization
  // Swap trigger: cheaper model available for simple tasks

  // ── Image Generation ──
  [ModelRole.IMAGE_PRIMARY]: process.env.MODEL_IMAGE_PRIMARY || "gpt-image-1",
  // Provider: OpenAI — uses openai client
  // Used for: primary post image generation (MVP)

  [ModelRole.IMAGE_SECONDARY]:
    process.env.MODEL_IMAGE_SECONDARY || "stable-diffusion-3",
  // Provider: Stability AI — uses STABILITY_AI_API_KEY directly via HTTP
  // Used for: bulk/high-volume image generation (cheaper per image)

  // ── Embeddings ──
  [ModelRole.EMBEDDINGS]:
    process.env.MODEL_EMBEDDINGS || "text-embedding-3-small",
  // Provider: OpenAI — uses openai client
  // ⚠️ SWAP WARNING: changing embedding model invalidates ALL existing vectors in Qdrant.

  // ── Video Generation ──
  [ModelRole.VIDEO_SHORT]: process.env.MODEL_VIDEO_SHORT || "gen3a_turbo",
  // Provider: Runway ML — uses RUNWAYML_API_KEY directly via HTTP

  [ModelRole.VIDEO_PRESENTER]: process.env.MODEL_VIDEO_PRESENTER || "heygen-v2",
  // Provider: HeyGen — uses HEYGEN_API_KEY directly via HTTP (Phase 6+)

  // ── Voice / Audio ──
  [ModelRole.VOICEOVER]:
    process.env.MODEL_VOICEOVER || "eleven_multilingual_v2",
  // Provider: ElevenLabs — uses ELEVENLABS_API_KEY directly via HTTP
};

// ── Capability Map ────────────────────────────────────────────────
// Documents what each model role does — helps future engineers understand
// the impact of swapping any given model.
const MODEL_CAPABILITIES: Record<ModelRole, string> = {
  [ModelRole.AGENT_REASONING]:
    "Deep thinking, strategy, competitor synthesis, brand DNA — highest quality required",
  [ModelRole.AGENT_FAST]:
    "Simple tasks, Egyptian Arabic copy, quick replies — cost efficiency prioritized",
  [ModelRole.IMAGE_PRIMARY]:
    "Primary post image generation — quality matters, moderate volume",
  [ModelRole.IMAGE_SECONDARY]:
    "Bulk image generation — cost matters, high volume",
  [ModelRole.EMBEDDINGS]:
    "Vector embeddings for Qdrant memory — consistency critical, do not swap lightly",
  [ModelRole.VIDEO_SHORT]: "Short-form video for Reels/TikTok — speed matters",
  [ModelRole.VIDEO_PRESENTER]:
    "Talking-head/spokesperson video — realism matters",
  [ModelRole.VOICEOVER]: "Egyptian Arabic audio — dialect accuracy critical",
};

// ── getModel ──────────────────────────────────────────────────────
// The ONLY way to resolve a model string at runtime.
// Never read MODELS directly — always call getModel(ModelRole.X).
function getModel(role: ModelRole): string {
  const model: string | undefined = MODELS[role];
  if (!model) {
    throw new Error(
      `Unknown model role: ${role}. Check shared/config/models.ts`,
    );
  }
  return model;
}

export { MODELS, MODEL_CAPABILITIES, getModel };
