import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../utils/logger";

let qdrantClient: QdrantClient | null = null;

function getQdrantClient(): QdrantClient {
  if (qdrantClient) {
    return qdrantClient;
  }

  const qdrantUrl: string = process.env.QDRANT_URL || "";
  const qdrantApiKey: string = process.env.QDRANT_API_KEY || "";

  if (!qdrantUrl) {
    throw new Error("QDRANT_URL is not defined in environment variables");
  }

  if (!qdrantApiKey) {
    throw new Error("QDRANT_API_KEY is not defined in environment variables");
  }

  try {
    qdrantClient = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    });
    logger.info("QdrantClient initialized");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Failed to initialize QdrantClient: ${message}`);
    throw new Error(`Qdrant initialization failed: ${message}`);
  }

  return qdrantClient;
}

export { getQdrantClient };
