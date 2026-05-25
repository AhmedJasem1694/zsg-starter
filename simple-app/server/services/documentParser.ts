import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { createWorker } from "tesseract.js";
// pdf-parse v2 exports a class-based API: new PDFParse({ data: buffer }).getText()
// The old v1 function-call pattern (pdfParse(buffer)) no longer works.
import { PDFParse } from "pdf-parse";

export interface ParseResult {
  text: string;
  extractionMethod: "native_pdf" | "docx" | "ocr" | "failed";
  ocrUsed: boolean;
  pageCount: number;
  textLength: number;
  errorMessage: string | null;
}

const OCR_THRESHOLD = 500; // characters below this → treat as scanned

export async function parseDocument(filePath: string): Promise<ParseResult> {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  // ── DOCX ─────────────────────────────────────────────────────────────────
  if (ext === ".docx" || ext === ".doc") {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value ?? "";

      // Warn if mammoth returned warnings (e.g. unsupported elements)
      if (result.messages && result.messages.length > 0) {
        console.warn(`[documentParser] mammoth warnings for ${filePath}:`,
          result.messages.slice(0, 3).map((m) => m.message).join("; "));
      }

      // If text is suspiciously short, it may be a protected doc or only tracked changes
      if (text.length < 200) {
        const reason = text.length === 0
          ? "Could not extract text from this Word document. It may be password-protected or in an unsupported format. Please try saving as PDF and uploading again."
          : "Very little text was extracted from this document. It may be protected, in an unsupported format, or contain only tracked changes. Please accept all changes, remove protection, and re-upload.";
        console.warn(`[documentParser] DOCX sparse text (${text.length} chars): ${reason}`);
        return {
          text,
          extractionMethod: text.length === 0 ? "failed" : "docx",
          ocrUsed: false,
          pageCount: 1,
          textLength: text.length,
          errorMessage: reason,
        };
      }

      return {
        text,
        extractionMethod: "docx",
        ocrUsed: false,
        pageCount: 1,
        textLength: text.length,
        errorMessage: null,
      };
    } catch (err) {
      const errMsg = (err as Error).message ?? String(err);
      console.error(`[documentParser] mammoth FAILED for ${filePath}:`, errMsg);
      return {
        text: "",
        extractionMethod: "failed",
        ocrUsed: false,
        pageCount: 0,
        textLength: 0,
        errorMessage: `Could not extract text from this Word document: ${errMsg}. Please try saving as PDF and uploading again.`,
      };
    }
  }

  // ── PDF - native first ────────────────────────────────────────────────────
  if (ext === ".pdf") {
    let nativeText = "";
    let pageCount = 0;
    try {
      // pdf-parse v2: instantiate with the buffer, then call getText().
      // Wrap with a 30s timeout so the pipeline never stalls on a scanned/malformed PDF.
      const parser = new PDFParse({ data: buffer });
      const parseWithTimeout = Promise.race([
        parser.getText(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("pdf-parse timed out after 30s")), 30_000)
        ),
      ]);
      const result = await parseWithTimeout;
      nativeText = result.text ?? "";
      pageCount = result.total ?? 0; // TextResult.total = numPages
    } catch (err) {
      console.warn(`[documentParser] pdf-parse failed/timed out: ${(err as Error)?.message ?? String(err)}`);
      // native parse failed - will fall through to OCR
    }

    // If we got enough text, return it
    if (nativeText.trim().length >= OCR_THRESHOLD) {
      return {
        text: nativeText,
        extractionMethod: "native_pdf",
        ocrUsed: false,
        pageCount,
        textLength: nativeText.length,
        errorMessage: null,
      };
    }

    // ── OCR fallback ─────────────────────────────────────────────────────
    // NOTE: Tesseract.js expects image data (PNG/JPEG), not a raw PDF buffer.
    // Passing a PDF buffer will throw or return garbage. Until a pdf-to-image
    // converter (e.g. pdf2pic / pdftoppm) is wired in, we return what native
    // parsing produced and log the limitation so it's visible in server logs.
    console.warn(
      `[documentParser] Scanned PDF detected (${nativeText.length} chars native text) - ` +
      `OCR skipped: pass PDF pages through an image converter before Tesseract. ` +
      `Returning native text as-is for ${filePath}`
    );
    return {
      text: nativeText,
      extractionMethod: nativeText.length > 0 ? "native_pdf" : "failed",
      ocrUsed: false,
      pageCount,
      textLength: nativeText.length,
      errorMessage: nativeText.length < OCR_THRESHOLD
        ? "Scanned PDF: native text below threshold, OCR not yet implemented - consider providing a text-based PDF"
        : null,
    };
  }

  return {
    text: "",
    extractionMethod: "failed",
    ocrUsed: false,
    pageCount: 0,
    textLength: 0,
    errorMessage: `Unsupported file type: ${ext}`,
  };
}

// OCR using Tesseract.js - works on image-based PDFs by treating each page
// as rendered. We use Tesseract directly on the PDF buffer (tesseract.js
// can process PDFs directly in Node.js).
async function runOcrOnPdf(_filePath: string, buffer: Buffer): Promise<string> {
  // @ts-ignore - tesseract.js types may vary by version
  const worker = await createWorker("eng");
  try {
    // Tesseract.js can OCR a Buffer directly
    // @ts-ignore
    const { data: { text } } = await worker.recognize(buffer);
    return text as string;
  } finally {
    await worker.terminate();
  }
}

function cleanOcrText(text: string): string {
  return text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .replace(/Page \d+/gi, "")
    .trim();
}

// Keep old signature for compatibility - returns just the text string
export async function parseDocumentText(filePath: string): Promise<string> {
  const result = await parseDocument(filePath);
  return result.text;
}

export function chunkText(text: string): string[] {
  const raw = text
    .split(/\n{2,}|\r\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 50);

  const chunks: string[] = [];
  let current = "";

  for (const block of raw) {
    if ((current + " " + block).length > 2000) {
      if (current) chunks.push(current.trim());
      current = block;
    } else {
      current = current ? current + "\n\n" + block : block;
    }
  }
  if (current) chunks.push(current.trim());

  return chunks;
}
