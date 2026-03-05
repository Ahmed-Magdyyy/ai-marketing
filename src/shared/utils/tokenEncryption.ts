// ─────────────────────────────────────────────────────────────────
// Token Encryption — AES-256-GCM
// Encrypts social media access tokens before MongoDB storage.
// Format: iv:authTag:ciphertext (all base64-encoded).
// Supports lazy key rotation via TOKEN_ENCRYPTION_KEY_PREV.
// ─────────────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { logger } from "./logger";

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set in environment");
  }
  return key;
}

function getPrevEncryptionKey(): string | undefined {
  return process.env.TOKEN_ENCRYPTION_KEY_PREV || undefined;
}

function getKeyBuffer(base64Key: string): Buffer {
  const buf = Buffer.from(base64Key, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be 32 bytes (256 bits). Got ${buf.length} bytes.`,
    );
  }
  return buf;
}

function encryptToken(plaintext: string): string {
  const key = getKeyBuffer(getEncryptionKey());
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

function decryptWithKey(encrypted: string, keyBase64: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted token format. Expected iv:authTag:ciphertext",
    );
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = Buffer.from(parts[2], "base64");
  const key = getKeyBuffer(keyBase64);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

function decryptToken(encrypted: string): string {
  try {
    return decryptWithKey(encrypted, getEncryptionKey());
  } catch (primaryError) {
    const prevKey = getPrevEncryptionKey();
    if (prevKey) {
      try {
        logger.info("token_decrypt_fallback_to_prev_key", {
          reason: "Primary key failed, trying previous key for lazy rotation",
        });
        return decryptWithKey(encrypted, prevKey);
      } catch {
        throw primaryError;
      }
    }
    throw primaryError;
  }
}

export { encryptToken, decryptToken };
