// ─────────────────────────────────────────────────────────────────
// Qdrant Vector Database Client
// Singleton client for Qdrant Cloud. Used by agent.memory.ts for
// storing and retrieving brand memory embeddings.
//
// Env vars:
//   QDRANT_URL      — Qdrant Cloud cluster URL (e.g. https://xyz.qdrant.io)
//   QDRANT_API_KEY  — API key for Qdrant Cloud authentication
// ─────────────────────────────────────────────────────────────────

import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../utils/logger";

// ── Collection Constants ─────────────────────────────────────────
// text-embedding-3-small produces 1536-dimensional vectors.
// ⚠️ If you swap the embedding model, update EMBEDDING_DIMENSION
// and re-embed all stored memories (see CLAUDE.md Scenario 4).

export const QDRANT_COLLECTION_NAME = "brand_memories";
export const EMBEDDING_DIMENSION = 1536;

// ── Client Singleton ─────────────────────────────────────────────
// Reads QDRANT_URL and QDRANT_API_KEY from process.env.
// Logs a warning if env vars are missing — memory features degrade
// gracefully (agent.memory.ts checks client availability).

const qdrantUrl = process.env.QDRANT_URL;
const qdrantApiKey = process.env.QDRANT_API_KEY;

let qdrantClient: QdrantClient | null = null;

if (qdrantUrl && qdrantApiKey) {
  qdrantClient = new QdrantClient({
    url: qdrantUrl,
    apiKey: qdrantApiKey,
  });
} else {
  logger.warn("qdrant_client_not_configured", {
    hasUrl: Boolean(qdrantUrl),
    hasApiKey: Boolean(qdrantApiKey),
    message:
      "Qdrant not configured — agent memory features will be unavailable. " +
      "Set QDRANT_URL and QDRANT_API_KEY in .env to enable.",
  });
}

// ── ensureCollection ─────────────────────────────────────────────
// Creates the brand_memories collection if it doesn't exist.
// Called once at startup (e.g. from server.ts or workers.ts).
// Idempotent — safe to call multiple times.

async function ensureCollection(): Promise<void> {
  if (!qdrantClient) return;

  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === QDRANT_COLLECTION_NAME,
    );

    if (!exists) {
      await qdrantClient.createCollection(QDRANT_COLLECTION_NAME, {
        vectors: {
          size: EMBEDDING_DIMENSION,
          distance: "Cosine",
        },
      });

      // Create payload index for filtered searches (userId + brandId)
      await qdrantClient.createPayloadIndex(QDRANT_COLLECTION_NAME, {
        field_name: "userId",
        field_schema: "keyword",
      });

      await qdrantClient.createPayloadIndex(QDRANT_COLLECTION_NAME, {
        field_name: "brandId",
        field_schema: "keyword",
      });

      logger.info("qdrant_collection_created", {
        collection: QDRANT_COLLECTION_NAME,
        dimension: EMBEDDING_DIMENSION,
      });
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown Qdrant error";
    logger.error("qdrant_ensure_collection_failed", { error: message });
  }
}

export { qdrantClient, ensureCollection };
