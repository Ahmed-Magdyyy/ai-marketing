import {
  MessageParam,
  ImageBlockParam,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { UploadedFileModel } from "../upload/upload.model";
import { getStorageClient, getStorageBucket } from "../../shared/config/r2";
import { logger } from "../../shared/utils/logger";

const MAX_TOTAL_TEXT_CHARS = 50000;
const TRUNCATION_WARNING = "[محتوى الملف اتقطع بسبب الحد الأقصى للنص]";

export async function buildAgentContext(
  userId: string,
  fileIds: string[] | undefined,
  userMessage: string,
): Promise<{
  enrichedMessages: MessageParam[];
  imageBlocks: ImageBlockParam[];
}> {
  // If no files provided, return early without DB calls
  if (!fileIds || fileIds.length === 0) {
    const rawEnrichedMessages: MessageParam[] = [];
    if (userMessage.trim().length > 0) {
      rawEnrichedMessages.push({
        role: "user",
        content: userMessage,
      });
    }
    return {
      enrichedMessages: rawEnrichedMessages,
      imageBlocks: [],
    };
  }

  // Max 5 files per message
  const uniqueFileIds = Array.from(new Set(fileIds)).slice(0, 5);

  // Fetch only files belonging to this user
  const files = await UploadedFileModel.find({
    _id: { $in: uniqueFileIds },
    userId,
  });

  const imageBlocks: ImageBlockParam[] = [];
  let attachedTextContext = "";
  let currentTotalChars = 0;

  for (const file of files) {
    try {
      if (file.assetType === "document" && file.extractedText) {
        // Document: prepend to context
        let textToAdd = file.extractedText;
        let truncated = false;

        if (currentTotalChars >= MAX_TOTAL_TEXT_CHARS) {
          continue; // No space left
        }

        if (currentTotalChars + textToAdd.length > MAX_TOTAL_TEXT_CHARS) {
          const allowedLength = MAX_TOTAL_TEXT_CHARS - currentTotalChars;
          textToAdd = textToAdd.substring(0, allowedLength);
          truncated = true;
        }

        attachedTextContext += `\n[UPLOADED DOCUMENT: ${file.filename}]\n${textToAdd}`;
        if (truncated) {
          attachedTextContext += `\n${TRUNCATION_WARNING}`;
        }
        currentTotalChars += textToAdd.length;
      } else if (file.assetType === "brand_asset") {
        // Brand Asset
        if (file.extractedText) {
          // SVGs with extracted text
          let textToAdd = file.extractedText;
          let truncated = false;

          if (currentTotalChars >= MAX_TOTAL_TEXT_CHARS) {
            continue;
          }

          if (currentTotalChars + textToAdd.length > MAX_TOTAL_TEXT_CHARS) {
            const allowedLength = MAX_TOTAL_TEXT_CHARS - currentTotalChars;
            textToAdd = textToAdd.substring(0, allowedLength);
            truncated = true;
          }

          attachedTextContext += `\n[BRAND ASSET: ${file.filename}]\n${textToAdd}`;
          if (truncated) {
            attachedTextContext += `\n${TRUNCATION_WARNING}`;
          }
          currentTotalChars += textToAdd.length;
        } else if (!file.extractedText && file.parseWarning) {
          // Files like .ai, .eps, .psd with parse warnings
          attachedTextContext += `\n[BRAND ASSET: ${file.filename}]\n[تحذير: ${file.parseWarning}]`;
        } else if (!file.extractedText) {
          // Images: Download from R2 and append to imageBlocks
          const client = getStorageClient();
          const bucket = getStorageBucket();
          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: file.r2Key,
          });

          const response = await client.send(command);

          if (response.Body) {
            const byteArray = await response.Body.transformToByteArray();
            const buffer = Buffer.from(byteArray);
            const base64Data = buffer.toString("base64");

            // Verify supported anthropic image type
            let mediaType = file.mimeType;
            if (
              !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
                mediaType,
              )
            ) {
              logger.warn(
                `Fallback media type for Anthropic for file type: ${mediaType}`,
              );
              mediaType = "image/jpeg";
            }

            imageBlocks.push({
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: base64Data,
              },
            });
          }
        }
      }
    } catch (error: unknown) {
      // Skip silently if missing from DB or R2 errors, but log warning
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.warn(
        `Skipping file context injection for ${file._id}: ${message}`,
      );
    }
  }

  const enrichedMessages: MessageParam[] = [];
  const contentArray: Array<TextBlockParam | ImageBlockParam> = [];

  const finalPrefix = attachedTextContext.trim();
  const fullText =
    finalPrefix.length > 0
      ? `${finalPrefix}\n\n${userMessage}`.trim()
      : userMessage.trim();

  if (fullText.length > 0) {
    contentArray.push({ type: "text", text: fullText });
  }

  for (const block of imageBlocks) {
    contentArray.push(block);
  }

  // Anthropic API supports content as string or array of blocks
  // Wait, if no images, should we use array or string? Array is safer and fully supported.
  if (contentArray.length > 0) {
    enrichedMessages.push({
      role: "user",
      content:
        contentArray.length === 1 && contentArray[0].type === "text"
          ? contentArray[0].text // Safe optimization
          : contentArray,
    });
  }

  return {
    enrichedMessages,
    imageBlocks,
  };
}
