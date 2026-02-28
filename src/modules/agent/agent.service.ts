// ─────────────────────────────────────────────────────────────────
// Agent Service — Core Orchestration
// Handles the full agent conversation loop:
//   1. Load last 50 messages from ConversationMessageModel
//   2. Build system prompt (BASE_SYSTEM_PROMPT + brand context)
//   3. Enrich user message with uploaded file context
//   4. Call Anthropic API with streaming
//   5. Execute tool calls via executeToolWithRetry (3 retries, exponential backoff)
//   6. Track tokens via aiCostTracker
//   7. Save user + assistant messages to ConversationMessageModel
//
// Rules from CLAUDE.md:
//   - Always use getReasoningModel() — never getModel('AGENT_REASONING') directly
//   - All tool calls use executeToolWithRetry — max 3 retries
//   - No `any` — explicit types everywhere
//   - No console.log — use logger
//   - Error handling: catch (error: unknown), use ErrorCode enum
// ─────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ContentBlock,
  ToolUseBlock,
  ToolResultBlockParam,
  TextBlock,
} from "@anthropic-ai/sdk/resources/messages";
import { ConversationMessageModel } from "./message.model";
import { buildAgentContext } from "./agent.context";
import { BASE_SYSTEM_PROMPT, getBrandContextPrompt } from "./agent.prompts";
import { agentTools } from "./agent.tools";
import { getReasoningModel } from "../../shared/middleware/killSwitch.middleware";
import { trackTokenUsage } from "../../shared/utils/aiCostTracker";
import { logger } from "../../shared/utils/logger";
import { IBrandProfile, ConversationRole, ErrorCode } from "../../shared/types";
import { getIO } from "../../shared/utils/socketProvider";

// ── Anthropic Client ─────────────────────────────────────────────
// Reads ANTHROPIC_API_KEY from process.env automatically.

const anthropic = new Anthropic();

// ── Constants ────────────────────────────────────────────────────

const MAX_HISTORY_MESSAGES = 50;
const MAX_TOKENS = 8096;
const MAX_TOOL_RETRIES = 3;
const TOOL_RETRY_BASE_DELAY_MS = 1000;
const MAX_TOOL_LOOP_ITERATIONS = 10;

// ── executeToolWithRetry ─────────────────────────────────────────
// CLAUDE.md Rule 5: All agent tool calls use executeToolWithRetry.
// Max 3 retries with exponential backoff.
// Actual tool implementations are stubbed — will be wired to real
// modules (research.scraper, Apify, BullMQ, etc.) in later phases.

async function executeToolWithRetry(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string,
): Promise<{ success: boolean; data: unknown; error?: string }> {
  for (let attempt = 1; attempt <= MAX_TOOL_RETRIES; attempt++) {
    try {
      const result = await executeTool(toolName, toolInput, userId);
      return result;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown tool error";

      if (attempt === MAX_TOOL_RETRIES) {
        logger.warn("tool_execution_failed_all_retries", {
          toolName,
          userId,
          attempts: MAX_TOOL_RETRIES,
          error: message,
        });
        return {
          success: false,
          data: null,
          error: `فشل تنفيذ الأداة بعد ${MAX_TOOL_RETRIES} محاولات: ${message}`,
        };
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = TOOL_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn("tool_execution_retry", {
        toolName,
        userId,
        attempt,
        delay,
        error: message,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // TypeScript safety — should never reach here
  return { success: false, data: null, error: "Unexpected retry exhaustion" };
}

// ── executeTool (Stub) ───────────────────────────────────────────
// Maps tool names to their actual implementations.
// Each case will be replaced with real module calls in later phases.
// For now, returns descriptive stubs so agent.service.ts compiles
// and the conversation loop can be tested end-to-end.

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string,
): Promise<{ success: boolean; data: unknown; error?: string }> {
  logger.info("tool_execution_start", { toolName, userId, toolInput });

  switch (toolName) {
    case "search_web":
      // TODO: Wire to Serper/Tavily via research.search.ts
      return {
        success: true,
        data: {
          results: [],
          message: `بحث عن: ${String(toolInput.query)} — سيتم التنفيذ في المرحلة القادمة`,
        },
      };

    case "scrape_website":
      // TODO: Wire to smartScrape() in research.scraper.ts
      return {
        success: true,
        data: {
          text: "",
          message: `سكرابينج لـ: ${String(toolInput.url)} — سيتم التنفيذ في المرحلة القادمة`,
        },
      };

    case "deep_crawl_competitor":
      // TODO: Wire to deepCrawlCompetitor() in research.scraper.ts + Socket.io
      return {
        success: true,
        data: {
          pages: [],
          message: `كراولينج عميق لـ: ${String(toolInput.url)} — سيتم التنفيذ في المرحلة القادمة`,
        },
      };

    case "scrape_social_profile":
      // TODO: Wire to Apify actors
      return {
        success: true,
        data: {
          profile: null,
          message: `تحليل حساب ${String(toolInput.platform)}: ${String(toolInput.handle)} — سيتم التنفيذ في المرحلة القادمة`,
        },
      };

    case "save_brand_memory":
      // TODO: Wire to MongoDB + Qdrant
      return {
        success: true,
        data: {
          saved: true,
          message:
            "تم حفظ المعلومة في ذاكرة البراند — سيتم التنفيذ في المرحلة القادمة",
        },
      };

    case "retrieve_brand_memory":
      // TODO: Wire to Qdrant vector search
      return {
        success: true,
        data: {
          memories: [],
          message: `بحث في الذاكرة عن: ${String(toolInput.query)} — سيتم التنفيذ في المرحلة القادمة`,
        },
      };

    case "generate_marketing_plan":
      // TODO: Wire to BullMQ pipeline
      return {
        success: true,
        data: {
          planId: null,
          message: `إنشاء خطة تسويقية لشهر ${String(toolInput.month)}/${String(toolInput.year)} — سيتم التنفيذ في المرحلة القادمة`,
        },
      };

    case "get_arab_calendar":
      // TODO: Wire to arabCalendar.ts
      return {
        success: true,
        data: {
          occasions: [],
          message: `مناسبات شهر ${String(toolInput.month)}/${String(toolInput.year)} لدولة ${String(toolInput.country)} — سيتم التنفيذ في المرحلة القادمة`,
        },
      };

    default:
      return {
        success: false,
        data: null,
        error: `أداة غير معروفة: ${toolName}`,
      };
  }
}

// ── Build System Prompt ──────────────────────────────────────────
// Brand context comes FIRST — it frames everything so the base
// instructions apply to the specific brand.
// CLAUDE.md Rule 16: Always use getReasoningModel() for Opus calls.

function buildSystemPrompt(brandProfile: IBrandProfile | null): string {
  if (brandProfile) {
    return getBrandContextPrompt(brandProfile) + "\n\n" + BASE_SYSTEM_PROMPT;
  }

  return BASE_SYSTEM_PROMPT;
}

// ── Load Conversation History ────────────────────────────────────
// Fetches last 50 messages from ConversationMessageModel, sorted
// by timestamp ascending (oldest first) for the Anthropic API.

async function loadConversationHistory(
  userId: string,
): Promise<MessageParam[]> {
  const rawMessages = await ConversationMessageModel.find({ userId })
    .sort({ timestamp: -1 })
    .limit(MAX_HISTORY_MESSAGES)
    .lean();

  // Reverse to chronological order (oldest first)
  rawMessages.reverse();

  const history: MessageParam[] = [];

  for (const msg of rawMessages) {
    const role = msg.role as string;

    if (role === ConversationRole.User) {
      history.push({ role: "user", content: msg.content });
    } else if (role === ConversationRole.Assistant) {
      history.push({ role: "assistant", content: msg.content });
    }
    // Tool messages are not included in history — they were part of
    // the tool use loop within a single turn, not standalone messages.
  }

  return history;
}

// ── Save Message ─────────────────────────────────────────────────
// Persists a single message to ConversationMessageModel.

async function saveMessage(
  userId: string,
  role: ConversationRole,
  content: string,
): Promise<void> {
  await ConversationMessageModel.create({
    userId,
    role,
    content,
    timestamp: new Date(),
  });
}

// ── Extract Text from Content Blocks ─────────────────────────────
// Anthropic responses contain an array of ContentBlock. This extracts
// all text blocks and joins them into a single reply string.

function extractTextFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

// ── Check for Tool Use Blocks ────────────────────────────────────
// Filters content blocks for tool_use type.

function extractToolUseBlocks(blocks: ContentBlock[]): ToolUseBlock[] {
  return blocks.filter(
    (block): block is ToolUseBlock => block.type === "tool_use",
  );
}

// ── Main Chat Function ───────────────────────────────────────────
// Orchestrates the full agent conversation loop.
//
// Flow:
//   1. Load conversation history (last 50 messages)
//   2. Enrich current user message with uploaded file context
//   3. Build system prompt with brand context
//   4. Call Anthropic API
//   5. If tool_use → execute tools → send results → repeat (max 10 iterations)
//   6. Extract final text reply
//   7. Track token usage
//   8. Save user + assistant messages
//   9. Return reply + token counts

export async function chat(
  userId: string,
  userMessage: string,
  brandProfile: IBrandProfile | null,
  fileIds: string[] | undefined,
  socketId: string | undefined,
): Promise<{ reply: string; inputTokens: number; outputTokens: number }> {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    // ── 1. Load conversation history ──
    const history = await loadConversationHistory(userId);

    // ── 2. Enrich user message with uploaded file context ──
    const { enrichedMessages } = await buildAgentContext(
      userId,
      fileIds,
      userMessage,
    );

    // ── 3. Build system prompt ──
    const systemPrompt = buildSystemPrompt(brandProfile);

    // ── 4. Build messages array ──
    // History + enriched current message
    const messages: MessageParam[] = [...history, ...enrichedMessages];

    // ── 5. Resolve model ──
    // CLAUDE.md Rule 16: Always use getReasoningModel() — respects KILL_OPUS
    const model = getReasoningModel();

    // ── 6. Conversation loop (handles multi-turn tool use) ──
    let loopCount = 0;
    let currentMessages = messages;
    let finalReply = "";

    while (loopCount < MAX_TOOL_LOOP_ITERATIONS) {
      loopCount++;

      // ── Streaming API call ──
      // Uses messages.stream() instead of messages.create()
      // so we can emit real-time text deltas to the client via Socket.io.
      const stream = await anthropic.messages.stream({
        model,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: agentTools,
        messages: currentMessages,
      });

      // Emit each text delta to the client in real-time
      stream.on("text", (text) => {
        if (socketId) {
          try {
            getIO().to(socketId).emit("agent:chunk", { chunk: text });
          } catch (err) {
            // handle case if IO not initialized
            logger.warn("Socket not initialized when emitting chunk", { err });
          }
        }
      });

      // Wait for the full response to complete
      const response = await stream.finalMessage();

      // Track tokens for this API call
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Check if Claude wants to use tools
      const toolUseBlocks = extractToolUseBlocks(response.content);

      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
        // No tool use — extract final text reply
        finalReply = extractTextFromBlocks(response.content);
        break;
      }

      // ── Tool Execution Loop ──
      // Claude wants to call tools — execute them and send results back
      const toolResults: ToolResultBlockParam[] = [];

      for (const toolBlock of toolUseBlocks) {
        const toolResult = await executeToolWithRetry(
          toolBlock.name,
          toolBlock.input as Record<string, unknown>,
          userId,
        );

        logger.info("tool_execution_complete", {
          toolName: toolBlock.name,
          userId,
          success: toolResult.success,
          socketId,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: JSON.stringify(toolResult.data),
          is_error: !toolResult.success,
        });
      }

      // Append assistant response (with tool_use blocks) and tool results
      // to the message chain for the next iteration
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
    }

    // Safety: if we hit max iterations without a final reply
    if (!finalReply && loopCount >= MAX_TOOL_LOOP_ITERATIONS) {
      logger.warn("agent_tool_loop_max_iterations", {
        userId,
        loopCount,
        socketId,
      });
      finalReply =
        "عذراً، استخدمت عدد كبير من الأدوات. ممكن تعيد السؤال بشكل أبسط؟";
    }

    // ── 7. Track total token usage ──
    await trackTokenUsage(
      userId,
      model,
      totalInputTokens,
      totalOutputTokens,
      "agent_chat",
    );

    // ── 8. Save messages ──
    // Save user message first
    await saveMessage(userId, ConversationRole.User, userMessage);

    // Save assistant reply
    if (finalReply.trim().length > 0) {
      await saveMessage(userId, ConversationRole.Assistant, finalReply);
    }

    // ── Emit completion to client ──
    if (socketId) {
      try {
        getIO().to(socketId).emit("agent:done", { reply: finalReply });
      } catch (err) {
        logger.warn("Socket not initialized when emitting done", { err });
      }
    }

    // ── 9. Return ──
    return {
      reply: finalReply,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error in agent chat";

    logger.error("agent_chat_error", {
      userId,
      error: message,
      socketId,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    });

    // If we tracked some tokens before the error, still save them
    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      try {
        const model = getReasoningModel();
        await trackTokenUsage(
          userId,
          model,
          totalInputTokens,
          totalOutputTokens,
          "agent_chat_error",
        );
      } catch (trackError: unknown) {
        const trackMsg =
          trackError instanceof Error
            ? trackError.message
            : "Unknown tracking error";
        logger.warn("agent_chat_token_tracking_failed", {
          userId,
          error: trackMsg,
        });
      }
    }

    // Throw with ErrorCode for controller-level handling
    const agentError = new Error(message);
    (agentError as Error & { code: string }).code = ErrorCode.ProviderDown;
    throw agentError;
  }
}
