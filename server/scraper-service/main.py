# ─────────────────────────────────────────────────────────────────
# Scrapling Microservice — FastAPI + Scrapling
# Provides tiered web scraping (Fast/Dynamic/Stealth) and deep crawl.
# Run: uvicorn main:app --host 0.0.0.0 --port 8000
# ─────────────────────────────────────────────────────────────────

import asyncio
import json
import time
import uuid
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, HttpUrl
from scrapling.fetchers import Fetcher, AsyncFetcher
from scrapling.fetchers import StealthyFetcher

app = FastAPI(
    title="Scrapling Service",
    description="Tiered web scraping microservice for AI Social Media platform",
    version="1.0.0",
)


# ── Request / Response Models ────────────────────────────────────


class ScrapeRequest(BaseModel):
    url: HttpUrl
    timeout: int = 15_000  # ms
    wait_selector: str | None = None  # CSS selector — Dynamic/Stealth only


class ScrapeResponse(BaseModel):
    url: str
    title: str
    body_text: str
    meta_description: str
    headings: list[str]
    status_code: int
    tier: int


class CrawlRequest(BaseModel):
    start_url: HttpUrl
    crawl_id: str | None = None
    max_pages: int = 20
    time_cap_seconds: int = 120
    checkpoint_pages: list[str] | None = None  # resume from these URLs


# ── Helpers ──────────────────────────────────────────────────────


def extract_page_data(page, url: str, tier: int) -> dict:
    """Extract structured data from a Scrapling page response."""
    title = ""
    meta_description = ""
    headings = []
    body_text = ""

    try:
        title_el = page.css_first("title")
        title = title_el.text() if title_el else ""
    except Exception:
        pass

    try:
        meta_el = page.css_first('meta[name="description"]')
        meta_description = meta_el.attrib.get("content", "") if meta_el else ""
    except Exception:
        pass

    try:
        for tag in ["h1", "h2", "h3"]:
            for el in page.css(tag):
                text = el.text().strip()
                if text:
                    headings.append(text)
    except Exception:
        pass

    try:
        body_el = page.css_first("body")
        body_text = body_el.text(separator=" ").strip() if body_el else ""
    except Exception:
        pass

    return {
        "url": str(url),
        "title": title,
        "body_text": body_text[:50_000],  # cap raw text before Node sanitizes
        "meta_description": meta_description,
        "headings": headings[:50],
        "status_code": getattr(page, "status", 200),
        "tier": tier,
    }


# ── Tier 1: Fast (static HTTP) ──────────────────────────────────


@app.post("/scrape/fast", response_model=ScrapeResponse)
async def scrape_fast(req: ScrapeRequest):
    """Tier 1 — Simple HTTP fetch via Scrapling Fetcher. Fastest, no JS."""
    try:
        fetcher = AsyncFetcher(auto_match=False)
        page = await fetcher.get(str(req.url), timeout=req.timeout / 1000)
        return extract_page_data(page, str(req.url), tier=1)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Fast scrape failed: {str(e)}")


# ── Tier 2: Dynamic (JS rendering) ──────────────────────────────


@app.post("/scrape/dynamic", response_model=ScrapeResponse)
async def scrape_dynamic(req: ScrapeRequest):
    """Tier 2 — JS rendering via Scrapling DynamicFetcher (PlayWright-based)."""
    try:
        # DynamicFetcher is synchronous — run in thread pool
        from scrapling.fetchers import PlayWrightFetcher

        def _fetch():
            fetcher = PlayWrightFetcher(auto_match=True)
            return fetcher.fetch(
                str(req.url),
                headless=True,
                timeout=req.timeout,
                wait_selector=req.wait_selector,
            )

        page = await asyncio.to_thread(_fetch)
        return extract_page_data(page, str(req.url), tier=2)
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Dynamic scrape failed: {str(e)}"
        )


# ── Tier 3: Stealth (anti-bot bypass) ───────────────────────────


@app.post("/scrape/stealth", response_model=ScrapeResponse)
async def scrape_stealth(req: ScrapeRequest):
    """Tier 3 — Anti-bot bypass via Scrapling StealthyFetcher."""
    try:

        def _fetch():
            fetcher = StealthyFetcher(auto_match=True)
            return fetcher.fetch(
                str(req.url),
                headless=True,
                timeout=req.timeout,
                wait_selector=req.wait_selector,
            )

        page = await asyncio.to_thread(_fetch)
        return extract_page_data(page, str(req.url), tier=3)
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Stealth scrape failed: {str(e)}"
        )


# ── Deep Crawl (NDJSON streaming) ────────────────────────────────


@app.post("/crawl/competitor/stream")
async def crawl_competitor_stream(req: CrawlRequest):
    """
    Deep crawl a competitor website. Streams NDJSON — one JSON object per line
    per page crawled. Supports resume via checkpoint_pages and time cap.
    """
    crawl_id = req.crawl_id or str(uuid.uuid4())

    async def stream_crawl():
        visited: set[str] = set()
        queue: list[str] = []
        start_time = time.time()

        # If resuming, skip already-crawled pages
        if req.checkpoint_pages:
            visited.update(req.checkpoint_pages)

        queue.append(str(req.start_url))
        base_domain = urlparse(str(req.start_url)).netloc
        pages_scraped = 0

        # Multi-session: fast fetcher (default) + stealth fetcher (fallback)
        fast_fetcher = Fetcher(auto_match=False)
        stealth_fetcher = StealthyFetcher(auto_match=True)

        def _fast_fetch(url: str):
            return fast_fetcher.get(url, timeout=15)

        def _stealth_fetch(url: str):
            return stealth_fetcher.fetch(url, headless=True, timeout=15_000)

        def _is_blocked(page) -> bool:
            """Detect bot-protection / blocked responses."""
            status = getattr(page, "status", 200)
            if status in (403, 429, 503):
                return True
            try:
                body = page.css_first("body")
                text = (body.text() if body else "").lower()[:500]
                blocked_signals = [
                    "access denied",
                    "captcha",
                    "cloudflare",
                    "just a moment",
                    "ray id",
                    "bot detection",
                    "please verify",
                ]
                return any(signal in text for signal in blocked_signals)
            except Exception:
                return False

        while queue and pages_scraped < req.max_pages:
            # Time cap check
            elapsed = time.time() - start_time
            if elapsed > req.time_cap_seconds:
                # Emit checkpoint event so Node can resume later
                checkpoint = {
                    "type": "checkpoint",
                    "crawl_id": crawl_id,
                    "pages_scraped": pages_scraped,
                    "remaining_urls": queue[:50],
                    "reason": "time_cap_reached",
                }
                yield json.dumps(checkpoint) + "\n"
                break

            url = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)

            try:
                # Start with fast fetch (non-blocking)
                page = await asyncio.to_thread(_fast_fetch, url)
                used_tier = 1

                # If blocked, escalate to stealth session
                if _is_blocked(page):
                    page = await asyncio.to_thread(_stealth_fetch, url)
                    used_tier = 3

                pages_scraped += 1

                # Extract internal links
                internal_links = []
                try:
                    for link in page.css("a[href]"):
                        href = link.attrib.get("href", "")
                        if href.startswith("/"):
                            href = f"https://{base_domain}{href}"
                        parsed = urlparse(href)
                        if parsed.netloc == base_domain and href not in visited:
                            internal_links.append(href)
                            if href not in queue:
                                queue.append(href)
                except Exception:
                    pass

                data = extract_page_data(page, url, used_tier)
                item = {
                    "type": "page",
                    "crawl_id": crawl_id,
                    "page_number": pages_scraped,
                    "url": data["url"],
                    "title": data["title"],
                    "headings": data["headings"],
                    "body_text": data["body_text"][:10_000],
                    "meta_description": data["meta_description"],
                    "internal_links": internal_links[:30],
                    "tier": used_tier,
                }
                yield json.dumps(item) + "\n"

            except Exception as e:
                error_item = {
                    "type": "error",
                    "crawl_id": crawl_id,
                    "url": url,
                    "error": str(e),
                }
                yield json.dumps(error_item) + "\n"
                continue

        # Final summary
        done = {
            "type": "done",
            "crawl_id": crawl_id,
            "pages_scraped": pages_scraped,
            "total_visited": len(visited),
        }
        yield json.dumps(done) + "\n"

    return StreamingResponse(
        stream_crawl(),
        media_type="application/x-ndjson",
        headers={"X-Crawl-Id": crawl_id},
    )


# ── Health Check ─────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok", "service": "scrapling"}
