import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { logger } from "../utils/logger";

// ── Storage Provider Abstraction ──────────────────────────────────
// Supports both Cloudflare R2 (production) and Backblaze B2 (development).
// Both expose an S3-compatible API — same client, different endpoint.
//
// Switch via STORAGE_PROVIDER env var:
//   STORAGE_PROVIDER=b2  → Backblaze B2 (no credit card required)
//   STORAGE_PROVIDER=r2  → Cloudflare R2 (zero egress, production)
//
// Each provider reads its own set of env vars.

type StorageProvider = "r2" | "b2";

interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  provider: StorageProvider;
}

function resolveStorageConfig(): StorageConfig {
  const provider = (process.env.STORAGE_PROVIDER as StorageProvider) || "b2";

  if (provider === "r2") {
    // ── Cloudflare R2 ──────────────────────────────────────────────
    const accountId = process.env.R2_ACCOUNT_ID || "";
    const accessKeyId = process.env.R2_ACCESS_KEY || "";
    const secretAccessKey = process.env.R2_SECRET_KEY || "";
    const bucket = process.env.R2_BUCKET || "";

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        "Missing Cloudflare R2 env vars. Set R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET.",
      );
    }

    return {
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: "auto",
      accessKeyId,
      secretAccessKey,
      bucket,
      provider: "r2",
    };
  }

  // ── Backblaze B2 (default for development) ───────────────────────
  const endpoint = process.env.B2_ENDPOINT || "";
  const accessKeyId = process.env.B2_APPLICATION_KEY_ID || "";
  const secretAccessKey = process.env.B2_APPLICATION_KEY || "";
  const bucket = process.env.B2_BUCKET || "";

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "Missing Backblaze B2 env vars. Set B2_ENDPOINT, B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET.",
    );
  }

  return {
    endpoint,
    region: "us-west-004", // B2 regions are like us-west-004, eu-central-003, etc.
    accessKeyId,
    secretAccessKey,
    bucket,
    provider: "b2",
  };
}

// ── Singleton client ──────────────────────────────────────────────

let storageClient: S3Client | null = null;
let storageConfig: StorageConfig | null = null;

function getStorageClient(): S3Client {
  if (storageClient) {
    return storageClient;
  }

  storageConfig = resolveStorageConfig();

  try {
    storageClient = new S3Client({
      region: storageConfig.region,
      endpoint: storageConfig.endpoint,
      credentials: {
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
      },
      forcePathStyle: storageConfig.provider === "b2", // B2 requires path-style
    });

    const label =
      storageConfig.provider === "r2" ? "Cloudflare R2" : "Backblaze B2";
    logger.info(`${label} S3Client initialized`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Failed to initialize storage S3Client: ${message}`);
    throw new Error(`Storage initialization failed: ${message}`);
  }

  return storageClient;
}

function getStorageBucket(): string {
  if (!storageConfig) {
    getStorageClient(); // triggers config resolution
  }
  return storageConfig!.bucket;
}

/**
 * Uploads a buffer to object storage (R2 or B2) and returns the key.
 * Calling code is provider-agnostic — same interface for both.
 */
async function uploadToStorage(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const client = getStorageClient();
  const bucket = getStorageBucket();

  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await client.send(command);
    logger.debug(`Uploaded ${key} to ${storageConfig!.provider}`);
    return key;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Storage upload failed (${key}): ${message}`);
    throw new Error(`Storage upload failed: ${message}`);
  }
}

/**
 * Deletes an object from storage (R2 or B2) by its key.
 */
async function deleteFromStorage(key: string): Promise<void> {
  const client = getStorageClient();
  const bucket = getStorageBucket();

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    logger.debug(`Deleted ${key} from ${storageConfig!.provider}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Storage delete failed (${key}): ${message}`);
    throw new Error(`Storage delete failed: ${message}`);
  }
}

// ── Backward-compat exports ───────────────────────────────────────
// Existing code using getR2Client / uploadToR2 still works.
export const getR2Client = getStorageClient;
export const uploadToR2 = uploadToStorage;
export const R2_BUCKET = process.env.R2_BUCKET || process.env.B2_BUCKET || "";

// ── Preferred exports (provider-agnostic naming) ──────────────────
export {
  getStorageClient,
  getStorageBucket,
  uploadToStorage,
  deleteFromStorage,
};
