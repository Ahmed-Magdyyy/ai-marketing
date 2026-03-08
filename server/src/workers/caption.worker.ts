// ─────────────────────────────────────────────────────────────────
// Caption Generation Worker
// BullMQ worker: generates captions using Claude Sonnet.
// Dialect from brandDNA.contentDialect — see LANGUAGE section.
// ─────────────────────────────────────────────────────────────────

import { Worker, Job } from "bullmq";
import Anthropic from "@anthropic-ai/sdk";
import { getRedisClient } from "../shared/config/redis";
import { QueueName, ContentJobData } from "../shared/config/queues";
import { getModel } from "../shared/config/models";
import { ModelRole, AssetType, ArabicDialect } from "../shared/types";
import { SWITCHES } from "../shared/middleware/killSwitch.middleware";
import { trackTokenUsage } from "../shared/utils/aiCostTracker";
import { getIO } from "../shared/utils/socketProvider";
import { ContentItemModel } from "../modules/plan/plan.model";
import { logger } from "../shared/utils/logger";

// ── Anthropic Client ─────────────────────────────────────────────

const anthropic = new Anthropic();

// ── Dialect Prompt Map ───────────────────────────────────────────

const DIALECT_PROMPTS: Record<string, string> = {
  [ArabicDialect.Egyptian]:
    "اكتب بالعامية المصرية — لهجة القاهرة، دافية وعفوية. أمثلة: يلا، بجد؟، ده هيبقى جامد، عايز تعرف السر؟",
  [ArabicDialect.Saudi]:
    "اكتب بالعامية السعودية / النجدية. أمثلة: وش، كذا، زين، حياك",
  [ArabicDialect.Gulf]:
    "اكتب بلهجة خليجية عامة مناسبة لجمهور الإمارات والكويت والبحرين وقطر وعُمان",
  [ArabicDialect.Levantine]:
    "اكتب بالعامية الشامية المناسبة للجمهور السوري واللبناني والأردني والفلسطيني",
  [ArabicDialect.Moroccan]:
    "اكتب بالدارجة المغاربية المناسبة للمغرب والجزائر وتونس",
  [ArabicDialect.Msa]:
    "اكتب بالعربية الفصحى الحديثة — رسمية، واضحة، ومناسبة لجميع الدول العربية",
  [ArabicDialect.English]: "Write in English, professional and clear",
};

function getDialectPrompt(dialect?: string): string {
  if (!dialect) return DIALECT_PROMPTS[ArabicDialect.Egyptian];
  return DIALECT_PROMPTS[dialect] ?? DIALECT_PROMPTS[ArabicDialect.Egyptian];
}

// ── Caption Generation ───────────────────────────────────────────

async function generateCaption(
  brief: string,
  brandDNA: ContentJobData["brandDNA"],
): Promise<{
  caption: string;
  hashtags: string[];
  inputTokens: number;
  outputTokens: number;
}> {
  const model = getModel(ModelRole.AgentFast);
  const dialectInstruction = getDialectPrompt(brandDNA.contentDialect);

  const systemPrompt = [
    "أنت كاتب محتوى سوشيال ميديا محترف.",
    dialectInstruction,
    brandDNA.tone ? `نبرة البراند: ${brandDNA.tone}` : "",
    brandDNA.personality ? `شخصية البراند: ${brandDNA.personality}` : "",
    "",
    "اكتب caption مناسب للبوست ده مع هاشتاجات.",
    "رد بـ JSON فقط بالشكل ده:",
    '{"caption": "...", "hashtags": ["#...", "#..."]}',
  ]
    .filter(Boolean)
    .join("\n");

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: brief }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const rawText = textBlock?.text ?? '{"caption":"","hashtags":[]}';

  const parsed: { caption: string; hashtags: string[] } = JSON.parse(rawText);

  return {
    caption: parsed.caption,
    hashtags: parsed.hashtags,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ── Worker ────────────────────────────────────────────────────────

function createCaptionWorker(): Worker<ContentJobData> {
  const worker = new Worker<ContentJobData>(
    QueueName.CaptionGeneration,
    async (job: Job<ContentJobData>) => {
      const startMs = Date.now();
      const { contentItemId, userId, brief, brandDNA } = job.data;

      if (SWITCHES.DISABLE_CONTENT_GENERATION || SWITCHES.READ_ONLY_MODE) {
        logger.warn("caption_worker_skipped", {
          userId,
          reason: "kill_switch_active",
        });
        return;
      }

      const model = getModel(ModelRole.AgentFast);

      const result = await generateCaption(brief, brandDNA);

      await ContentItemModel.findByIdAndUpdate(contentItemId, {
        $set: {
          caption: result.caption,
          hashtags: result.hashtags,
          status: "draft",
        },
        $push: {
          assets: { type: AssetType.Caption, url: "" },
        },
      });

      await trackTokenUsage(
        userId,
        model,
        result.inputTokens,
        result.outputTokens,
        "caption_generation",
      );

      const latencyMs = Date.now() - startMs;
      logger.info("job_complete", {
        userId,
        jobType: "caption",
        model,
        latencyMs,
      });

      try {
        const io = getIO();
        io.to(`user:${userId}`).emit("content:generated", {
          contentItemId,
          assetType: "caption",
          status: "draft",
        });
      } catch {
        logger.warn("socket_emit_failed", {
          userId,
          contentItemId,
          event: "content:generated",
        });
      }
    },
    {
      connection: getRedisClient(),
      concurrency: 10,
      limiter: {
        max: 50,
        duration: 10000,
      },
    },
  );

  worker.on("failed", (job: Job<ContentJobData> | undefined, err: Error) => {
    logger.error("caption_worker_failed", {
      jobId: job?.id,
      contentItemId: job?.data?.contentItemId,
      error: err.message,
    });
  });

  return worker;
}

export { createCaptionWorker };
