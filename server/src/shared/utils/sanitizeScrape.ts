// ─────────────────────────────────────────────────────────────────
// sanitizeScrape — Prompt injection defense for scraped content.
// MUST be called on every piece of scraped text before passing to AI.
// ─────────────────────────────────────────────────────────────────

/** Maximum characters returned after sanitization */
const MAX_LENGTH = 8_000;

/**
 * Prompt injection phrases to strip.
 * These patterns attempt to hijack the AI's system prompt via scraped content.
 * Case-insensitive matching — order doesn't matter.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|above|all)\s+instructions?/gi,
  /you\s+are\s+now\s+/gi,
  /system\s*:\s*/gi,
  /\[INST\]/gi,
  /<<\s*SYS\s*>>/gi,
  /\bact\s+as\b/gi,
  /pretend\s+you\s+are/gi,
  /do\s+not\s+follow\b[^.!?\n]*/gi,
];

/**
 * Sanitizes raw scraped HTML/text for safe AI consumption.
 *
 * Pipeline:
 * 1. Strip <script>, <style>, <meta>, <noscript> tags and their contents
 * 2. Remove hidden elements (display:none, visibility:hidden, aria-hidden)
 * 3. Strip all remaining HTML tags
 * 4. Decode HTML entities (&amp; → &, etc.)
 * 5. Remove prompt injection patterns
 * 6. Collapse whitespace (multiple spaces/newlines → single)
 * 7. Hard truncate at 8000 characters
 *
 * @param raw - Raw HTML or text from scraper
 * @returns Cleaned plain text safe for AI prompts
 */
export function sanitizeScrape(raw: string): string {
  if (!raw || typeof raw !== "string") return "";

  let text = raw;

  // 1. Strip dangerous/irrelevant tags and their contents
  text = text.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  text = text.replace(/<meta\b[^>]*\/?>/gi, "");
  text = text.replace(
    /<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi,
    "",
  );

  // 2. Remove hidden elements (common anti-scraping / tracking elements)
  text = text.replace(
    /<[^>]+(?:display\s*:\s*none|visibility\s*:\s*hidden|aria-hidden\s*=\s*["']true["'])[^>]*>[\s\S]*?<\/[^>]+>/gi,
    "",
  );

  // 3. Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // 4. Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, dec) =>
      String.fromCharCode(parseInt(dec, 10)),
    );

  // 5. Remove prompt injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    text = text.replace(pattern, "");
  }

  // 6. Collapse whitespace (multiple spaces/newlines/tabs → single space)
  text = text.replace(/\s+/g, " ").trim();

  // 7. Hard truncate
  if (text.length > MAX_LENGTH) {
    text = text.slice(0, MAX_LENGTH);
  }

  return text;
}
