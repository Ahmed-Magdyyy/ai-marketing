import {
  ScrapeOptions,
  ScrapeResult,
  ScrapingTier,
  CrawlItem,
} from "../../shared/types";
import { sanitizeScrape } from "../../shared/utils/sanitizeScrape";
import { logger } from "../../shared/utils/logger";

// ── Python service response shapes ──────────────────────────────

interface ScrapingServiceResponse {
  url: string;
  title: string;
  body_text: string;
  meta_description: string;
  headings: string[];
}

export interface NdjsonItem {
  type: string;
  crawl_id?: string;
  page_number?: number;
  url?: string;
  title?: string;
  headings?: string[];
  body_text?: string;
  meta_description?: string;
  internal_links?: string[];
  tier?: number;
  error?: string;
  pages_scraped?: number;
  remaining_urls?: string[];
  reason?: string;
}

export class ResearchScraper {
  /**
   * Translates tier enum to the appropriate Python endpoint
   */
  private static getEndpointForTier(tier: ScrapingTier): string {
    switch (tier) {
      case ScrapingTier.Fast:
        return "/scrape/fast";
      case ScrapingTier.Dynamic:
        return "/scrape/dynamic";
      case ScrapingTier.Stealth:
        return "/scrape/stealth";
      case ScrapingTier.Puppeteer:
        // Future implementation for Tier 4 in Node.js
        throw new Error("Puppeteer tier is not yet implemented.");
      default:
        return "/scrape/fast";
    }
  }

  /**
   * Scrapes a single URL utilizing the Python Scrapper Service.
   * Based on the requested tier, routes to the matching endpoint.
   */
  public static async scrapeSingle(
    options: ScrapeOptions,
  ): Promise<ScrapeResult> {
    const tier = options.tier || ScrapingTier.Fast;
    const endpoint = this.getEndpointForTier(tier);
    const baseUrl = process.env.SCRAPER_SERVICE_URL || "http://localhost:8000";

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: options.url,
        timeout: options.timeout,
        wait_selector: options.waitSelector,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Python Scraper Service Error (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as ScrapingServiceResponse;

    // Sanitize the text to handle prompt injection
    const sanitizedHtml = sanitizeScrape(data.body_text || "");

    return {
      url: data.url,
      title: data.title,
      bodyText: sanitizedHtml,
      metaDescription: data.meta_description || "",
      headings: data.headings || [],
      tier: tier,
      scrapedAt: new Date(),
    };
  }

  /**
   * Starts a deep crawl session with streaming NDJSON from the Python service.
   * Calls the provided onItem callback as items are parsed.
   */
  public static async deepCrawlAndStream(
    startUrl: string,
    maxPages: number,
    timeCapSeconds: number,
    onItem: (item: NdjsonItem) => void,
  ): Promise<void> {
    const baseUrl = process.env.SCRAPER_SERVICE_URL || "http://localhost:8000";

    const response = await fetch(`${baseUrl}/crawl/competitor/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start_url: startUrl,
        max_pages: maxPages,
        time_cap_seconds: timeCapSeconds,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Python Scraper Streaming Error (${response.status}): ${errorText}`,
      );
    }

    if (!response.body) {
      throw new Error("Response body is empty or not readable.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining data in the buffer
          if (buffer.trim()) {
            this.processNdjsonLine(buffer, onItem);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // The last line might be incomplete, so we keep it in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          this.processNdjsonLine(line, onItem);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Helper to safely parse and sanitize a single line of NDJSON.
   */
  private static processNdjsonLine(
    line: string,
    onItem: (item: NdjsonItem) => void,
  ): void {
    if (!line.trim()) return;

    try {
      const item = JSON.parse(line) as NdjsonItem;

      // Sanitize prompt injections on page returns
      if (item.type === "page" && item.body_text) {
        item.body_text = sanitizeScrape(item.body_text);
      }

      onItem(item);
    } catch (err) {
      logger.warn("research_scraper_ndjson_parse_error", {
        error: String(err),
        line,
      });
    }
  }
}
