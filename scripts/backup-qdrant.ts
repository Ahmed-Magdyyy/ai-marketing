/**
 * backup-qdrant.ts — Qdrant Snapshot + R2 Upload
 *
 * Calls Qdrant's snapshot API to create a snapshot,
 * downloads it, then uploads to Cloudflare R2 with a
 * timestamped key.
 *
 * Usage:
 *   npx ts-node scripts/backup-qdrant.ts
 *
 * Required ENV:
 *   QDRANT_URL          — e.g. http://localhost:6333
 *   QDRANT_COLLECTION   — collection name to snapshot
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET
 */

import "dotenv/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ── Config ──────────────────────────────────────────────────────
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const R2_BUCKET = process.env.R2_BUCKET;

if (
  !QDRANT_URL ||
  !QDRANT_COLLECTION ||
  !R2_ACCOUNT_ID ||
  !R2_ACCESS_KEY ||
  !R2_SECRET_KEY ||
  !R2_BUCKET
) {
  console.error(
    "❌ Missing required env vars: QDRANT_URL, QDRANT_COLLECTION, R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET",
  );
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY!,
    secretAccessKey: R2_SECRET_KEY!,
  },
});

// ── Main ────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // 1. Create snapshot via Qdrant API
  console.log(
    `📸 Creating snapshot for collection "${QDRANT_COLLECTION}"...`,
  );
  const createRes = await fetch(
    `${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots`,
    { method: "POST" },
  );

  if (!createRes.ok) {
    throw new Error(
      `Failed to create snapshot: ${createRes.status} ${await createRes.text()}`,
    );
  }

  const createBody = (await createRes.json()) as {
    result: { name: string };
  };
  const snapshotName = createBody.result.name;
  console.log(`✅ Snapshot created: ${snapshotName}`);

  // 2. Download snapshot
  console.log("⬇️  Downloading snapshot...");
  const downloadUrl = `${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots/${snapshotName}`;
  const downloadRes = await fetch(downloadUrl);

  if (!downloadRes.ok) {
    throw new Error(
      `Failed to download snapshot: ${downloadRes.status} ${await downloadRes.text()}`,
    );
  }

  const buffer = Buffer.from(await downloadRes.arrayBuffer());
  const tmpPath = join(tmpdir(), `${snapshotName}`);
  writeFileSync(tmpPath, buffer);
  console.log(
    `✅ Downloaded to ${tmpPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`,
  );

  // 3. Upload to R2
  const r2Key = `backups/qdrant/${timestamp}_${snapshotName}`;
  console.log(`☁️  Uploading to R2: ${r2Key}...`);

  const fileContent = readFileSync(tmpPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: fileContent,
      ContentType: "application/octet-stream",
    }),
  );

  console.log("✅ Uploaded to R2 successfully");

  // 4. Clean up temp file
  unlinkSync(tmpPath);
  console.log("🧹 Temp file cleaned up");

  // 5. Delete snapshot from Qdrant (optional, keeps Qdrant disk clean)
  console.log("🗑️  Cleaning up Qdrant snapshot...");
  await fetch(
    `${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots/${snapshotName}`,
    { method: "DELETE" },
  );

  console.log(
    `\n── Summary ──────────────────────────────`,
  );
  console.log(`  Collection: ${QDRANT_COLLECTION}`);
  console.log(`  Snapshot: ${snapshotName}`);
  console.log(`  R2 Key: ${r2Key}`);
  console.log(`  Size: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
  console.log(`\n✅ Backup complete.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
