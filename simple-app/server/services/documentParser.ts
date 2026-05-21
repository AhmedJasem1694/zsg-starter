import fs from "fs";
import path from "path";
import { createRequire } from "module";
import mammoth from "mammoth";
import { createWorker } from "tesseract.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

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
      return {
        text: result.value,
        extractionMethod: "docx",
        ocrUsed: false,
        pageCount: 1,
        textLength: result.value.length,
        errorMessage: null,
      };
    } catch (err) {
      return {
        text: "",
        extractionMethod: "failed",
        ocrUsed: false,
        pageCount: 0,
        textLength: 0,
        errorMessage: (err as Error).message,
      };
    }
  }

  // ── PDF — native first ────────────────────────────────────────────────────
  if (ext === ".pdf") {
    let nativeText = "";
    let pageCount = 0;
    try {
      const result = await pdfParse(buffer);
      nativeText = result.text ?? "";
      pageCount = result.numpages ?? 0;
    } catch {
      // native parse failed — will fall through to OCR
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
    try {
      console.log(`[documentParser] Scanned PDF detected (${nativeText.length} chars). Running OCR on ${filePath}`);
      const ocrText = await runOcrOnPdf(filePath, buffer);
      const cleaned = cleanOcrText(ocrText);
      return {
        text: cleaned,
        extractionMethod: "ocr",
        ocrUsed: true,
        pageCount,
        textLength: cleaned.length,
        errorMessage: cleaned.length < 100 ? "OCR returned minimal text" : null,
      };
    } catch (err) {
      return {
        text: nativeText, // use whatever we got
        extractionMethod: "failed",
        ocrUsed: true,
        pageCount,
        textLength: nativeText.length,
        errorMessage: `OCR failed: ${(err as Error).message}`,
      };
    }
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

// OCR using Tesseract.js — works on image-based PDFs by treating each page
// as rendered. We use Tesseract directly on the PDF buffer (tesseract.js
// can process PDFs directly in Node.js).
async function runOcrOnPdf(_filePath: string, buffer: Buffer): Promise<string> {
  // @ts-ignore — tesseract.js types may vary by version
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

// Keep old signature for compatibility — returns just the text string
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
