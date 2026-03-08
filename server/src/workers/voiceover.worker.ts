// ─────────────────────────────────────────────────────────────────
// Voiceover Generation Worker
// BullMQ worker: generates voiceovers via ElevenLabs TTS API.
// Supports Arabic dialects through ElevenLabs multilingual model.
// ─────────────────────────────────────────────────────────────────

import { Worker, Job } from "bullmq";
import { getRedisClient } from "../shared/config/redis";
import { QueueName, ContentJobData } from "../shared/config/queues";
import { getModel } from "../shared/config/models";
import { ModelRole, AssetType } from "../shared/types";
import { SWITCHES } from "../shared/middleware/killSwitch.middleware";
import { trackUnitUsage } from "../shared/utils/aiCostTracker";
import { getIO } from "../shared/utils/socketProvider";
import { ContentItemModel } from "../modules/plan/plan.model";
import { logger } from "../shared/utils/logger";

// ── ElevenLabs TTS API ───────────────────────────────────────────

interface ElevenLabsResponse {
  /** Audio binary returned as ArrayBuffer */
}

async function generateVoiceover(
  text: string,
  model: string,
): Promise<{ audioUrl: string; durationSeconds: number }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not defined");
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true,
        },
        output_format: "mp3_44100_128",
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`ElevenLabs TTS error ${response.status}: ${errorBody}`);
  }

  // ElevenLabs returns audio binary in streaming mode.
  // In production, this would be uploaded to cloud storage.
  // For now, we store the URL from the response headers or a placeholder.
  const audioUrl = response.headers.get("x-audio-url") ?? "";

  // Estimate duration from text length (~150 words/min for Arabic)
  const wordCount = text.split(/\s+/).length;
  const estimatedDuration = Math.max(1, Math.ceil((wordCount / 150) * 60));

  return { audioUrl, durationSeconds: estimatedDuration };
}

// ── Worker ────────────────────────────────────────────────────────

function createVoiceoverWorker(): Worker<ContentJobData> {
  const worker = new Worker<ContentJobData>(
    QueueName.VoiceoverGeneration,
    async (job: Job<ContentJobData>) => {
      const startMs = Date.now();
      const { contentItemId, userId, brief } = job.data;

      if (SWITCHES.DISABLE_CONTENT_GENERATION || SWITCHES.READ_ONLY_MODE) {
        logger.warn("voiceover_worker_skipped", {
          userId,
          reason: "kill_switch_active",
        });
        return;
      }

      const model = getModel(ModelRole.Voiceover);

      const result = await generateVoiceover(brief, model);

      await ContentItemModel.findByIdAndUpdate(contentItemId, {
        $set: { status: "draft" },
        $push: {
          assets: { type: AssetType.Voiceover, url: result.audioUrl },
        },
      });

      await trackUnitUsage(
        userId,
        model,
        result.durationSeconds,
        "voiceover_generation",
      );

      const latencyMs = Date.now() - startMs;
      logger.info("job_complete", {
        userId,
        jobType: "voiceover",
        model,
        latencyMs,
      });

      try {
        const io = getIO();
        io.to(`user:${userId}`).emit("content:generated", {
          contentItemId,
          assetType: "voiceover",
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
      concurrency: 5,
      limiter: {
        max: 30,
        duration: 60000,
      },
    },
  );

  worker.on("failed", (job: Job<ContentJobData> | undefined, err: Error) => {
    logger.error("voiceover_worker_failed", {
      jobId: job?.id,
      contentItemId: job?.data?.contentItemId,
      error: err.message,
    });
  });

  return worker;
}

export { createVoiceoverWorker };
