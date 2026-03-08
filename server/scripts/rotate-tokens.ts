/**
 * rotate-tokens.ts — Lazy re-encrypt social tokens
 *
 * Connects to MongoDB, finds all brand social accounts
 * whose tokens were encrypted with TOKEN_ENCRYPTION_KEY_PREV,
 * decrypts them with the previous key, re-encrypts with the
 * current TOKEN_ENCRYPTION_KEY, and updates in-place.
 *
 * Usage:
 *   npx ts-node scripts/rotate-tokens.ts
 *
 * Required ENV:
 *   MONGODB_URI, TOKEN_ENCRYPTION_KEY, TOKEN_ENCRYPTION_KEY_PREV
 */

import "dotenv/config";
import mongoose from "mongoose";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ── Config ──────────────────────────────────────────────────────
const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const CURRENT_KEY = process.env.TOKEN_ENCRYPTION_KEY;
const PREV_KEY = process.env.TOKEN_ENCRYPTION_KEY_PREV;
const MONGODB_URI = process.env.MONGODB_URI;

if (!CURRENT_KEY || !PREV_KEY || !MONGODB_URI) {
  console.error(
    "❌ Missing required env vars: MONGODB_URI, TOKEN_ENCRYPTION_KEY, TOKEN_ENCRYPTION_KEY_PREV",
  );
  process.exit(1);
}

// ── Crypto helpers ──────────────────────────────────────────────
function getKeyBuffer(base64Key: string): Buffer {
  const buf = Buffer.from(base64Key, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `Key must be 32 bytes (256 bits). Got ${buf.length} bytes.`,
    );
  }
  return buf;
}

function decryptWithKey(encrypted: string, keyBase64: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format. Expected iv:authTag:ciphertext");
  }
  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = Buffer.from(parts[2], "base64");
  const key = getKeyBuffer(keyBase64);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8",
  );
}

function encryptWithKey(plaintext: string, keyBase64: string): string {
  const key = getKeyBuffer(keyBase64);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

// ── Main ────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("🔄 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);
  console.log("✅ Connected\n");

  const db = mongoose.connection.db!;
  const brandsCollection = db.collection("brandprofiles");
  const brands = await brandsCollection
    .find({ "socialAccounts.0": { $exists: true } })
    .toArray();

  console.log(`📋 Found ${brands.length} brands with social accounts\n`);

  let rotated = 0;
  let skipped = 0;
  let errors = 0;

  for (const brand of brands) {
    const accounts = (brand.socialAccounts || []) as Array<{
      accessToken?: string;
      refreshToken?: string;
      platform?: string;
    }>;

    let updated = false;

    for (const account of accounts) {
      const fields = ["accessToken", "refreshToken"] as const;

      for (const field of fields) {
        const encrypted = account[field];
        if (!encrypted) continue;

        // Try decrypting with current key first => already rotated
        try {
          decryptWithKey(encrypted, CURRENT_KEY!);
          skipped++;
          continue; // Already encrypted with current key
        } catch {
          // Needs rotation
        }

        // Try decrypting with previous key => rotate
        try {
          const plaintext = decryptWithKey(encrypted, PREV_KEY!);
          (account as Record<string, string>)[field] = encryptWithKey(
            plaintext,
            CURRENT_KEY!,
          );
          rotated++;
          updated = true;
          console.log(
            `  🔑 Rotated ${field} for ${account.platform || "unknown"} on brand ${brand._id}`,
          );
        } catch (err) {
          errors++;
          console.error(
            `  ❌ Failed to rotate ${field} for ${account.platform || "unknown"} on brand ${brand._id}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    if (updated) {
      await brandsCollection.updateOne(
        { _id: brand._id },
        { $set: { socialAccounts: accounts } },
      );
    }
  }

  console.log(`\n── Summary ──────────────────────────────`);
  console.log(`  Rotated: ${rotated}`);
  console.log(`  Skipped (already current): ${skipped}`);
  console.log(`  Errors: ${errors}`);

  await mongoose.disconnect();
  console.log("\n✅ Done. Disconnected from MongoDB.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
