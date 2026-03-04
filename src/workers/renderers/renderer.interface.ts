// ─────────────────────────────────────────────────────────────────
// Design Renderer Interface
// Abstraction layer so the design worker never references a
// specific provider (Canva, Figma, etc.) directly.
// To add a new renderer: implement IDesignRenderer and swap in
// design.worker.ts.
// ─────────────────────────────────────────────────────────────────

export interface DesignBrandAssets {
  /** Primary brand color hex */
  primaryColor?: string;
  /** Secondary brand color hex */
  secondaryColor?: string;
  /** Logo URL */
  logoUrl?: string;
  /** Font family name */
  fontFamily?: string;
}

export interface DesignRenderResult {
  /** Public URL to the generated design */
  url: string;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
}

export interface IDesignRenderer {
  /** Human-readable provider name for logging */
  readonly providerName: string;

  /**
   * Generate a design from a brief and brand assets.
   * @param brief - Creative brief / prompt
   * @param brandAssets - Brand visual identity assets
   * @returns Rendered design URL and optional dimensions
   */
  render(
    brief: string,
    brandAssets: DesignBrandAssets,
  ): Promise<DesignRenderResult>;
}
