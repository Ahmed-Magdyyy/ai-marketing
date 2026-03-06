// ─────────────────────────────────────────────────────────────────
// Agent Memory Service
// Core memory operations for the AI agent's long-term memory.
//
// Architecture:
//   1. Text → OpenAI embeddings (text-embedding-3-small, 1536-dim)
//   2. Vector → Qdrant Cloud (similarity search, filtered by userId+brandId)
//   3. Metadata → MongoDB AgentLearning (content, category, source, timestamps)
//
// All embedding API calls tracked via aiCostTracker.trackTokenUsage().
// Graceful degradation: if Qdrant is not configured, operations return
// empty results / skip storage with warnings (no throws).
// ─────────────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";
import { openai } from "../../shared/config/models";
import { getModel } from "../../shared/config/models";
import {
  qdrantClient,
  QDRANT_COLLECTION_NAME,
} from "../../shared/config/qdrant";
import { trackTokenUsage } from "../../shared/utils/aiCostTracker";
import { logger } from "../../shared/utils/logger";
import { ModelRole, MemoryCategory, LearningSource } from "../../shared/types";
import type { IAgentLearning } from "../../shared/types";
import { AgentLearningModel } from "./agentLearning.model";

// ── embedText ────────────────────────────────────────────────────
// Generates a 1536-dim embedding vector using OpenAI's embedding model.
// Cost tracked via aiCostTracker — context: "memory_embedding".
//
// Uses getModel(ModelRole.Embeddings) — never a hardcoded model string.

async function embedText(text: string, userId: string): Promise<number[]> {
  const model = getModel(ModelRole.Embeddings);

  const response = await openai.embeddings.create({
    model,
    input: text,
  });

  // Track embedding token usage
  const tokenCount = response.usage?.total_tokens ?? 0;
  await trackTokenUsage(userId, model, tokenCount, 0, "memory_embedding");

  return response.data[0].embedding;
}

// ── saveMemory ───────────────────────────────────────────────────
// Embeds content → stores vector in Qdrant → saves metadata in MongoDB.
// Returns the Qdrant point ID (UUID) on success, or null if unavailable.
//
// Flow:
//   1. Generate embedding vector from content text
//   2. Create a UUID for the Qdrant point
//   3. Upsert vector + payload into Qdrant
//   4. Save metadata (content, category, source, pointId) to MongoDB
//   5. Return pointId

async function saveMemory(
  userId: string,
  brandId: string,
  content: string,
  category: MemoryCategory,
  source: LearningSource,
): Promise<string | null> {
  if (!qdrantClient) {
    logger.warn("save_memory_skipped_no_qdrant", { userId, brandId });
    return null;
  }

  try {
    // 1. Embed the content
    const vector = await embedText(content, userId);

    // 2. Generate unique point ID
    const pointId = randomUUID();

    // 3. Upsert to Qdrant
    await qdrantClient.upsert(QDRANT_COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: pointId,
          vector,
          payload: {
            userId,
            brandId,
            category,
            source,
            createdAt: new Date().toISOString(),
          },
        },
      ],
    });

    // 4. Save metadata to MongoDB
    await AgentLearningModel.create({
      userId,
      brandId,
      content,
      category,
      source,
      qdrantPointId: pointId,
      createdAt: new Date(),
    });

    logger.info("memory_saved", {
      userId,
      brandId,
      category,
      source,
      pointId,
    });

    return pointId;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown memory save error";
    logger.error("save_memory_failed", {
      userId,
      brandId,
      category,
      error: message,
    });
    return null;
  }
}

// ── retrieveMemories ─────────────────────────────────────────────
// Embeds query → searches Qdrant by vector similarity (filtered by
// userId + brandId) → fetches full docs from MongoDB.
//
// Returns up to `limit` matching memories sorted by relevance.

async function retrieveMemories(
  userId: string,
  brandId: string,
  query: string,
  limit: number = 5,
): Promise<IAgentLearning[]> {
  if (!qdrantClient) {
    logger.warn("retrieve_memories_skipped_no_qdrant", { userId, brandId });
    return [];
  }

  try {
    // 1. Embed the search query
    const queryVector = await embedText(query, userId);

    // 2. Search Qdrant with userId + brandId filter
    const searchResults = await qdrantClient.search(QDRANT_COLLECTION_NAME, {
      vector: queryVector,
      limit,
      filter: {
        must: [
          { key: "userId", match: { value: userId } },
          { key: "brandId", match: { value: brandId } },
        ],
      },
      with_payload: false, // We'll fetch full content from MongoDB
    });

    if (searchResults.length === 0) {
      return [];
    }

    // 3. Extract point IDs from search results
    const pointIds = searchResults.map((result) => String(result.id));

    // 4. Fetch full documents from MongoDB (preserving Qdrant relevance order)
    const docs = await AgentLearningModel.find({
      qdrantPointId: { $in: pointIds },
    }).lean();

    // 5. Sort by Qdrant relevance order
    const docMap = new Map(
      docs.map((doc) => [doc.qdrantPointId, doc as unknown as IAgentLearning]),
    );
    const sorted: IAgentLearning[] = [];
    for (const id of pointIds) {
      const doc = docMap.get(id);
      if (doc) sorted.push(doc);
    }

    logger.info("memories_retrieved", {
      userId,
      brandId,
      queryLength: query.length,
      resultsCount: sorted.length,
    });

    return sorted;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown memory retrieval error";
    logger.error("retrieve_memories_failed", {
      userId,
      brandId,
      error: message,
    });
    return [];
  }
}

// ── pruneOldMemories ─────────────────────────────────────────────
// Deletes Qdrant vectors + MongoDB docs older than the user's plan
// allows (agentMemoryMonths). Called by the memory-prune job.
//
// Returns the number of memories pruned.

async function pruneOldMemories(
  userId: string,
  agentMemoryMonths: number,
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - agentMemoryMonths);

  try {
    // 1. Find expired MongoDB docs
    const expiredDocs = await AgentLearningModel.find(
      { userId, createdAt: { $lt: cutoffDate } },
      { qdrantPointId: 1 },
    ).lean();

    if (expiredDocs.length === 0) {
      return 0;
    }

    const pointIds = expiredDocs.map((doc) => doc.qdrantPointId);

    // 2. Delete from Qdrant (if connected)
    if (qdrantClient) {
      await qdrantClient.delete(QDRANT_COLLECTION_NAME, {
        wait: true,
        points: pointIds,
      });
    }

    // 3. Delete from MongoDB
    await AgentLearningModel.deleteMany({
      userId,
      createdAt: { $lt: cutoffDate },
    });

    logger.info("memories_pruned", {
      userId,
      agentMemoryMonths,
      prunedCount: pointIds.length,
      cutoffDate: cutoffDate.toISOString(),
    });

    return pointIds.length;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown prune error";
    logger.error("prune_memories_failed", {
      userId,
      agentMemoryMonths,
      error: message,
    });
    return 0;
  }
}

export { embedText, saveMemory, retrieveMemories, pruneOldMemories };
