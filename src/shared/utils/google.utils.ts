// ─────────────────────────────────────────────────────────────────
// Google OAuth Utility — verifies Google ID tokens
// Uses google-auth-library with GOOGLE_CLIENT_ID from env
// ─────────────────────────────────────────────────────────────────

import { OAuth2Client } from "google-auth-library";
import { logger } from "./logger";

export interface GooglePayload {
  providerUserId: string;
  email: string;
  name: string;
  picture: string;
}

let client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (client) return client;

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID must be set for Google authentication");
  }

  client = new OAuth2Client(clientId);
  return client;
}

export async function verifyGoogleToken(
  idToken: string,
): Promise<GooglePayload> {
  const oauth2Client = getClient();
  const clientId = process.env.GOOGLE_CLIENT_ID || "";

  const ticket = await oauth2Client.verifyIdToken({
    idToken,
    audience: clientId,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Invalid Google token payload");
  }

  logger.info("google_token_verified", { email: payload.email });

  return {
    providerUserId: payload.sub,
    email: payload.email,
    name: payload.name || "",
    picture: payload.picture || "",
  };
}
