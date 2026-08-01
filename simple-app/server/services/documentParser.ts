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

// ─── Boilerplate stripping (token cost reduction) ─────────────────────────────
// Removes content with no analytical value before the text is sent to LLMs:
// recital boilerplate, signature/execution blocks, and notice address lists.
// Conservative by design: every removal is bounded, and if stripping would
// remove more than 35% of the document the original text is returned untouched.

export interface StripResult {
  text: string;
  removedChars: number;
  removedSections: string[];
}

// Contract types where notice mechanics are analytically relevant. Never
// strip notice address blocks for these.
const NOTICE_SENSITIVE_CONTRACT_TYPES = /lease|property|nhs|healthcare|insurance|logistics/i;

export function stripBoilerplate(text: string, contractType: string = ""): StripResult {
  const original = text;
  const removedSections: string[] = [];
  let working = text;

  // 1. Signature / execution block: truncate from the execution language onward,
  //    but only if it sits in the final 25% of the document.
  const signatureRe = /\b(IN WITNESS WHEREOF|AS WITNESS the hands|EXECUTED as a deed|EXECUTED AND DELIVERED|SIGNED for and on behalf of|SIGNATURE PAGE FOLLOWS)\b/i;
  const sigMatch = signatureRe.exec(working);
  if (sigMatch && sigMatch.index > working.length * 0.75) {
    working = working.slice(0, sigMatch.index);
    removedSections.push("signature_block");
  }

  // 2. Recital boilerplate: the WHEREAS/RECITALS/BACKGROUND block between the
  //    parties intro and the operative-provisions marker. Only removed when the
  //    block starts in the first 20% of the document and the operative marker
  //    follows within a bounded span (15% of the document).
  const recitalStartRe = /\b(WHEREAS\b|RECITALS\b|BACKGROUND[:\s]*\n)/i;
  const operativeRe = /\b(NOW,?\s+THEREFORE|IT IS (HEREBY )?AGREED|THE PARTIES (HEREBY )?AGREE|OPERATIVE PROVISIONS|AGREED TERMS)\b/i;
  const recitalStart = recitalStartRe.exec(working);
  if (recitalStart && recitalStart.index < working.length * 0.2) {
    const tail = working.slice(recitalStart.index);
    const operative = operativeRe.exec(tail);
    if (operative && operative.index < working.length * 0.15) {
      working = working.slice(0, recitalStart.index) + working.slice(recitalStart.index + operative.index);
      removedSections.push("recitals");
    }
  }

  // 3. Notice address lists: runs of 3+ consecutive address/attention/fax lines
  //    (the "addresses for service" tables inside notices clauses). Skipped when
  //    the contract type makes notice mechanics relevant. The notice clause text
  //    itself (periods, methods) is never touched, only the address lists.
  if (!NOTICE_SENSITIVE_CONTRACT_TYPES.test(contractType)) {
    const addressRunRe = /((?:^[ \t]*(?:Address|Attention|Attn|For the attention of|Email|E-mail|Fax|Copy to|Postcode)[:\s][^\n]*\n){3,})/gim;
    const before = working.length;
    working = working.replace(addressRunRe, "[notice address details omitted]\n");
    if (working.length < before) removedSections.push("notice_addresses");
  }

  const removedChars = original.length - working.length;

  // Safety guard: never strip more than 35% of the document.
  if (removedChars <= 0 || removedChars > original.length * 0.35) {
    return { text: original, removedChars: 0, removedSections: [] };
  }
  return { text: working, removedChars, removedSections };
}

/**
 * Character offsets of each passage within the source document text.
 *
 * Passages must be supplied in document order. The scan is monotonic: each
 * search starts where the previous match ended, so boilerplate that appears
 * more than once resolves to the correct occurrence rather than always the
 * first. That is the whole point of storing offsets, since matching a clause
 * by its text alone highlights the wrong indemnity the moment a contract
 * repeats itself, which contracts do constantly.
 *
 * Matching is whitespace-insensitive and case-insensitive, because clause text
 * is reassembled from chunks and will not be byte-identical to the source.
 * Returns null for any passage that cannot be located.
 */
export function locatePassages(
  fullText: string,
  passages: string[],
): Array<{ start: number; end: number } | null> {
  // Normalised copy plus a map back to original indices.
  const map: number[] = [];
  let norm = "";
  let inWhitespace = false;
  for (let i = 0; i < fullText.length; i++) {
    const ch = fullText[i];
    if (/\s/.test(ch)) {
      if (!inWhitespace && norm.length > 0) { norm += " "; map.push(i); }
      inWhitespace = true;
    } else {
      norm += ch.toLowerCase();
      map.push(i);
      inWhitespace = false;
    }
  }

  const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  /**
   * Locate one fragment, preferring the first hit at or after `from`.
   *
   * Short fragments are allowed so a clause heading like "3. LIABILITY" anchors
   * the span and the heading highlights with its clause. They are only ever
   * matched forward of the cursor, because a short string is not distinctive
   * enough to search the whole document for without risking the wrong hit.
   */
  const find = (fragment: string, from: number): number => {
    const needle = normalise(fragment);
    if (needle.length < 8) return -1;
    const at = norm.indexOf(needle, from);
    if (at !== -1) return at;
    // Fall back to a search from the start only when the fragment is long
    // enough to be distinctive: the order categories are emitted in does not
    // always follow the document.
    return needle.length >= 20 ? norm.indexOf(needle) : -1;
  };

  let cursor = 0;
  return passages.map((passage) => {
    // A passage is a reassembled chunk, not necessarily a contiguous slice of
    // the document: blocks are trimmed and rejoined, and boilerplate stripping
    // may have removed text between them. Searching for the whole passage can
    // therefore miss. Anchor on its first and last blocks instead and span
    // between them, which restores anything dropped in between.
    const blocks = passage.split(/\n{2,}/).map((b) => b.trim()).filter((b) => normalise(b).length >= 8);
    if (blocks.length === 0) return null;

    // Anchor on the first block that can be located. A leading heading is
    // preferred so the highlight covers the clause heading too, but an
    // unlocatable one must not lose the whole clause.
    let firstAt = -1;
    let firstBlock = blocks[0];
    for (const block of blocks) {
      const at = find(block, cursor);
      if (at !== -1) { firstAt = at; firstBlock = block; break; }
    }
    if (firstAt === -1) return null;

    const lastBlock = blocks[blocks.length - 1];
    const lastAt = blocks.length === 1 ? firstAt : find(lastBlock, firstAt);
    const endNorm = lastAt === -1
      ? firstAt + normalise(firstBlock).length
      : lastAt + normalise(lastBlock).length;

    cursor = Math.max(firstAt + normalise(firstBlock).length, endNorm);

    const start = map[firstAt];
    const end = map[Math.min(endNorm - 1, map.length - 1)] + 1;
    return end > start ? { start, end } : null;
  });
}

const MAX_CHUNK = 2000;
/**
 * A chunk below this absorbs the next clause rather than standing alone. Set
 * low deliberately: it exists to stop a bare heading becoming its own chunk,
 * not to pad a short clause with an unrelated neighbouring one, which would
 * merge two clauses back into a single highlight.
 */
const MIN_CHUNK = 120;

/**
 * Whether a block opens a new top-level clause.
 *
 * Sub-numbering (8.1, 8.2) is deliberately NOT a boundary: splitting there
 * would hand the comparison step half a liability clause and call it the whole
 * position. Only top-level numbering, named divisions and short capitalised
 * titles start a new clause.
 */
function isClauseStart(block: string): boolean {
  const t = block.trim();
  if (!t) return false;
  if (/^\d+\.\d/.test(t)) return false;                                     // 8.1, sub-clause
  if (/^\d+[.)]?\s+\S/.test(t)) return true;                                // "8." or "8) Liability"
  if (/^(ARTICLE|CLAUSE|SECTION|SCHEDULE|APPENDIX|ANNEX|PART)\s+[\dIVXLC]/i.test(t)) return true;
  if (t.length <= 80 && /^[A-Z][A-Z0-9 \-&,'()/.]{2,}$/.test(t)) return true; // ALL CAPS heading
  return false;
}

/**
 * Split document text into chunks aligned to clause boundaries.
 *
 * Chunks are the unit the classifier assigns a category to and the unit the
 * split view highlights, so aligning them to clauses is what makes highlighting
 * land on one clause rather than on a two thousand character window containing
 * five. Headings are kept rather than discarded: they mark the boundaries, they
 * tell the classifier what it is reading, and keeping them makes a chunk close
 * to a contiguous slice of the source, which is what the offset scan needs.
 *
 * Falls back to size-based splitting for documents with no detectable clause
 * structure, which is the previous behaviour.
 */
export function chunkText(text: string): string[] {
  const blocks = text
    .split(/\n{2,}|\r\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Group blocks into clause units: a boundary block plus everything until the
  // next boundary.
  const units: string[][] = [];
  for (const block of blocks) {
    if (units.length === 0 || isClauseStart(block)) units.push([block]);
    else units[units.length - 1].push(block);
  }

  // A unit longer than the cap (an unstructured document is one big unit) is
  // split by size at block boundaries.
  const sized: string[] = [];
  for (const unit of units) {
    let current = "";
    for (const block of unit) {
      if (current && (current.length + block.length + 2) > MAX_CHUNK) { sized.push(current); current = block; }
      else current = current ? `${current}\n\n${block}` : block;
    }
    if (current) sized.push(current);
  }

  // Emit one chunk per clause, merging any that are too short to stand alone.
  const chunks: string[] = [];
  let current = "";
  for (const unit of sized) {
    if (!current) { current = unit; continue; }
    if (current.length < MIN_CHUNK && current.length + unit.length + 2 <= MAX_CHUNK) {
      current = `${current}\n\n${unit}`;
    } else {
      chunks.push(current);
      current = unit;
    }
  }
  if (current) chunks.push(current);

  // Drop chunks with no substantive content (a stray heading at the very end).
  return chunks.filter((c) => c.replace(/\s+/g, " ").length > 50);
}
