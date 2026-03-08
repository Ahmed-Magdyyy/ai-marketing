import { Tool } from "@anthropic-ai/sdk/resources/messages";

// ── Agent Tools ─────────────────────────────────────────────────
// All 8 tools the AI agent can invoke during conversation.
// Source: CLAUDE.md "Agent Tools (defined in agent.tools.ts)"
//
// Every tool call MUST be wrapped with executeToolWithRetry()
// (max 3 retries with exponential backoff) — see agent.service.ts.
//
// Tool mapping:
//   search_web            → Serper for discovery, Tavily for deep research
//   scrape_website        → calls smartScrape() in research.scraper.ts (Scrapling tiered routing)
//   deep_crawl_competitor → calls deepCrawlCompetitor(), streams pages via Socket.io
//   scrape_social_profile → Apify actors for Facebook/Instagram/TikTok
//   save_brand_memory     → persists to MongoDB + Qdrant
//   retrieve_brand_memory → vector similarity search from Qdrant
//   generate_marketing_plan → triggers plan generation pipeline via BullMQ
//   get_arab_calendar     → cultural moments for brand's target market country

export const agentTools: Tool[] = [
  // ── 1. Web Search ───────────────────────────────────────────────
  {
    name: "search_web",
    description:
      "ابحث على الإنترنت عن معلومات حديثة، أخبار، اتجاهات السوق، أو معلومات عن المنافسين. " +
      "يستخدم Serper للاكتشاف السريع و Tavily للبحث العميق. " +
      "استخدمه لما المستخدم يسأل عن حاجة محتاج فيها بيانات حديثة.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "The search query — can be in Arabic or English. Be specific for better results.",
        },
      },
      required: ["query"],
    },
  },

  // ── 2. Scrape Website ───────────────────────────────────────────
  {
    name: "scrape_website",
    description:
      "اقرأ محتوى صفحة ويب معينة من URL. يستخدم Scrapling مع tiered routing " +
      "(StealthFetcher → PlaywrightFetcher → full browser). " +
      "مفيد لقراءة مواقع المنافسين أو أي رابط المستخدم يبعتهولك.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The absolute URL of the website to scrape.",
        },
      },
      required: ["url"],
    },
  },

  // ── 3. Deep Crawl Competitor ────────────────────────────────────
  {
    name: "deep_crawl_competitor",
    description:
      "اعمل crawl عميق لموقع منافس — يمسح كل الصفحات المهمة (About, Services, Blog, Products). " +
      "يستخدم Scrapling Spider framework. النتائج بتتبعت للعميل في الوقت الحقيقي عبر Socket.io. " +
      "استخدمه في مرحلة البحث (Step 2) لتحليل المنافسين بعمق.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description:
            "The root URL of the competitor's website to deep-crawl.",
        },
        crawlId: {
          type: "string",
          description:
            "A unique identifier for this crawl session, used for idempotency and Socket.io streaming.",
        },
      },
      required: ["url", "crawlId"],
    },
  },

  // ── 4. Scrape Social Profile ────────────────────────────────────
  {
    name: "scrape_social_profile",
    description:
      "اجمع بيانات من صفحة سوشيال ميديا — فيسبوك، إنستجرام، أو تيكتوك. " +
      "يستخدم Apify actors (مش Puppeteer أو Scrapling — القاعدة: Apify = social profiles). " +
      "يرجع: عدد المتابعين، آخر البوستات، معدل التفاعل، وأكتر المحتوى نجاحاً.",
    input_schema: {
      type: "object" as const,
      properties: {
        platform: {
          type: "string",
          enum: ["facebook", "instagram", "tiktok"],
          description:
            "The social media platform to scrape — facebook, instagram, or tiktok.",
        },
        handle: {
          type: "string",
          description:
            "The page/profile handle or username to scrape (without @).",
        },
      },
      required: ["platform", "handle"],
    },
  },

  // ── 5. Save Brand Memory ────────────────────────────────────────
  {
    name: "save_brand_memory",
    description:
      "احفظ معلومة مهمة في ذاكرة البراند (MongoDB + Qdrant). " +
      "استخدمه لحفظ insights من المحادثة، نتايج البحث، تفضيلات العميل، " +
      "أو أي حاجة محتاج تفتكرها في المحادثات الجاية.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description:
            "The text content to store in brand memory — insights, preferences, research findings, etc.",
        },
        category: {
          type: "string",
          enum: [
            "competitor_insight",
            "brand_preference",
            "audience_insight",
            "content_feedback",
            "strategy_note",
            "general",
          ],
          description: "Category to classify this memory for better retrieval.",
        },
      },
      required: ["content", "category"],
    },
  },

  // ── 6. Retrieve Brand Memory ────────────────────────────────────
  {
    name: "retrieve_brand_memory",
    description:
      "ارجع لذاكرة البراند وابحث عن معلومات مخزنة سابقاً. " +
      "يستخدم vector similarity search في Qdrant. " +
      "مفيد لاسترجاع تفضيلات العميل، نتايج بحث سابقة، أو ملاحظات استراتيجية.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Natural language query describing what to search for in brand memory.",
        },
      },
      required: ["query"],
    },
  },

  // ── 7. Generate Marketing Plan ──────────────────────────────────
  {
    name: "generate_marketing_plan",
    description:
      "اعمل خطة تسويقية شهرية كاملة للبراند. " +
      "يشغل pipeline التوليد عبر BullMQ — يشمل Content Pillars، جدول النشر، " +
      "والمحتوى لكل بلاتفورم حسب الباقة. " +
      "استخدمه في Step 5 بعد موافقة العميل على الاستراتيجية.",
    input_schema: {
      type: "object" as const,
      properties: {
        brandId: {
          type: "string",
          description: "The brand profile ID to generate the plan for.",
        },
        month: {
          type: "number",
          description: "The target month (1-12) for the marketing plan.",
        },
        year: {
          type: "number",
          description: "The target year for the marketing plan.",
        },
      },
      required: ["brandId", "month", "year"],
    },
  },

  // ── 8. Arab Calendar ────────────────────────────────────────────
  {
    name: "get_arab_calendar",
    description:
      "جيب المناسبات الثقافية والدينية والوطنية القادمة في بلد معين. " +
      "يشمل: رمضان، العيدين، أعياد وطنية، مواسم خاصة (زي الدراسة). " +
      "استخدمه لتخطيط المحتوى حول المناسبات المهمة للجمهور المستهدف.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: {
          type: "number",
          description: "The month number (1-12) to get events for.",
        },
        year: {
          type: "number",
          description: "The year to get events for.",
        },
        country: {
          type: "string",
          description:
            "Country code for the brand's target market — e.g. 'EG' for Egypt, 'SA' for Saudi Arabia, 'AE' for UAE, 'JO' for Jordan.",
        },
      },
      required: ["month", "year", "country"],
    },
  },
];
