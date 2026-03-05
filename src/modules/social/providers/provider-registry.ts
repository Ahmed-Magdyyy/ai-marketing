// ─────────────────────────────────────────────────────────────────
// Provider Registry
// Maps SocialPlatform → SocialProvider implementation.
// Providers register themselves on import via registerProvider().
// ─────────────────────────────────────────────────────────────────

import type { SocialPlatform } from "../../../shared/types";
import type { SocialProvider } from "./social-provider.interface";

const providers = new Map<SocialPlatform, SocialProvider>();

function registerProvider(provider: SocialProvider): void {
  providers.set(provider.platform, provider);
}

function getProvider(platform: SocialPlatform): SocialProvider {
  const provider = providers.get(platform);
  if (!provider) {
    throw new Error(`No provider registered for platform: ${platform}`);
  }
  return provider;
}

function getRegisteredPlatforms(): SocialPlatform[] {
  return Array.from(providers.keys());
}

export { registerProvider, getProvider, getRegisteredPlatforms };
