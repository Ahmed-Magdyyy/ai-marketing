import { randomUUID } from "crypto";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import * as xlsx from "xlsx";
import { uploadToStorage } from "../../shared/config/r2";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode } from "../../shared/types";

export interface ProcessFileUploadInput {
  userId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
}

export interface ProcessFileUploadResult {
  fileId: string;
  filename: string;
  mimeType: string;
  assetType: "document" | "brand_asset";
  extractedText: string | null;
  parseWarning: string | null;
  r2Key: string;
  fileSizeBytes: number;
}

export class UploadService {
  /**
   * Processes a single uploaded file, parses its content based on type,
   * enforces size limits, and uploads it to storage.
   */
  public static async processFile(
    input: ProcessFileUploadInput,
  ): Promise<ProcessFileUploadResult> {
    const { userId, filename, mimeType, buffer, size } = input;
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const fileId = randomUUID();

    // Determine category and assetType
    let category: "document" | "image" | "design" | "svg" = "document";
    let assetType: "document" | "brand_asset" = "document";

    const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
    const isDesign = ["ai", "eps", "psd"].includes(ext);
    const isSvg = ext === "svg";

    if (isImage) {
      category = "image";
      assetType = "brand_asset";
    } else if (isDesign) {
      category = "design";
      assetType = "brand_asset";
    } else if (isSvg) {
      category = "svg";
      assetType = "brand_asset";
    } else {
      category = "document";
      assetType = "document";
    }

    // Size limits check
    const MAX_10MB = 10 * 1024 * 1024;
    const MAX_50MB = 50 * 1024 * 1024;
    const MAX_2MB = 2 * 1024 * 1024;

    switch (category) {
      case "document":
      case "image":
        if (size > MAX_10MB) {
          throw new ApiError(
            400,
            ErrorCode.ValidationError,
            `File size exceeds 10MB limit for ${category}.`,
          );
        }
        break;
      case "design":
        if (size > MAX_50MB) {
          throw new ApiError(
            400,
            ErrorCode.ValidationError,
            "File size exceeds 50MB limit for design files.",
          );
        }
        break;
      case "svg":
        if (size > MAX_2MB) {
          throw new ApiError(
            400,
            ErrorCode.ValidationError,
            "File size exceeds 2MB limit for SVG files.",
          );
        }
        break;
    }

    // Parsing logic
    let extractedText: string | null = null;
    let parseWarning: string | null = null;

    try {
      if (category === "document") {
        if (ext === "pdf") {
          const parser = new PDFParse({ data: buffer });
          const pdfData = await parser.getText();
          extractedText = pdfData.text;
        } else if (ext === "docx") {
          const docxData = await mammoth.extractRawText({ buffer });
          extractedText = docxData.value;
        } else if (ext === "xlsx") {
          const workbook = xlsx.read(buffer, { type: "buffer" });
          let text = "";
          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            text += xlsx.utils.sheet_to_csv(worksheet) + "\n";
          }
          extractedText = text;
        } else if (["txt", "md", "csv"].includes(ext)) {
          extractedText = buffer.toString("utf-8");
        } else {
          // Fallback for other documents, treat as stringifiable if possible or leave empty
          extractedText = buffer.toString("utf-8");
        }
      } else if (category === "svg") {
        extractedText = buffer.toString("utf-8");
      } else if (category === "image") {
        extractedText = null;
      } else if (category === "design") {
        if (ext === "ai") {
          try {
            const aiParser = new PDFParse({ data: buffer });
            const pdfData = await aiParser.getText();
            extractedText = pdfData.text;
          } catch (e) {
            // .ai files might not always have parseable PDF structures
            extractedText = null;
          }
          parseWarning =
            "ملف Adobe Illustrator — تم استخراج النصوص والألوان المتاحة. للنتايج الأحسن، ارفع نسخة PDF أو PNG.";
        } else if (ext === "eps" || ext === "psd") {
          extractedText = null;
          parseWarning =
            "تم حفظ الملف. للنتايج الأحسن، حوّل الملف لـ PDF أو PNG وارفعه تاني.";
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      parseWarning = `Failed to parse file content: ${msg}`;
    }

    // Upload to Storage
    const subfolder = assetType === "document" ? "docs" : "brand";
    const r2Key = `uploads/${userId}/${subfolder}/${fileId}.${ext}`;

    await uploadToStorage(r2Key, buffer, mimeType);

    return {
      fileId,
      filename,
      mimeType,
      assetType,
      extractedText,
      parseWarning,
      r2Key,
      fileSizeBytes: size,
    };
  }
}
