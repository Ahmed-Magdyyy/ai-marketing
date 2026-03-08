// ─────────────────────────────────────────────────────────────────
// Canva Design Renderer (MVP Stub)
// Implements IDesignRenderer using Canva Connect API.
// MVP: returns placeholder URL — swap with real Canva API call
// when Connect API access is available.
// ─────────────────────────────────────────────────────────────────

import {
  IDesignRenderer,
  DesignBrandAssets,
  DesignRenderResult,
} from "./renderer.interface";
import { logger } from "../../shared/utils/logger";

class CanvaRenderer implements IDesignRenderer {
  readonly providerName = "canva";

  async render(
    brief: string,
    brandAssets: DesignBrandAssets,
  ): Promise<DesignRenderResult> {
    const apiKey = process.env.CANVA_API_KEY;

    if (!apiKey) {
      // MVP fallback: return placeholder when API key not configured
      logger.warn("canva_renderer_no_api_key", {
        message: "CANVA_API_KEY not set — returning placeholder design URL",
      });

      return {
        url: `https://placeholder.design/canva?brief=${encodeURIComponent(brief.slice(0, 100))}`,
        width: 1080,
        height: 1080,
      };
    }

    // ── Canva Connect API Integration ─────────────────────────────
    // When Canva access is available, implement:
    // 1. POST /v1/designs — create design from template
    // 2. Apply brand assets (colors, logo, font)
    // 3. Export as PNG/JPG
    // 4. Return public URL

    const response = await fetch("https://api.canva.com/rest/v1/designs", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        design_type: "InstagramPost",
        title: brief.slice(0, 100),
        brand_template: {
          primary_color: brandAssets.primaryColor,
          secondary_color: brandAssets.secondaryColor,
          logo_url: brandAssets.logoUrl,
          font_family: brandAssets.fontFamily,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Canva API error ${response.status}: ${errorBody}`);
    }

    const result = (await response.json()) as {
      design: { urls: { view_url: string } };
    };

    return {
      url: result.design.urls.view_url,
      width: 1080,
      height: 1080,
    };
  }
}

export { CanvaRenderer };
