import { chatComplete } from "./openrouter.js";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface LLMJsonOptions {
  messages: Message[];
  model?: string;
  maxTokens?: number;
  description?: string; // for logging
  /** Per-attempt timeout. Default 60s; batched calls with large outputs need more. */
  timeoutMs?: number;
  /**
   * Set when the call returns content lifted verbatim from a contract, an
   * email, or a company register. Skips the house-style post-processor so
   * source material is never rewritten. See textStyle.ts.
   */
  preserveVerbatim?: boolean;
}

export async function llmJsonCall<T>(opts: LLMJsonOptions): Promise<T> {
  const { messages, model, maxTokens, description = "LLM call", timeoutMs = 60_000, preserveVerbatim } = opts;

  // First attempt
  const firstResponse = await chatComplete(messages, maxTokens, timeoutMs, model, { preserveVerbatim });
  const firstResult = tryParseJson<T>(firstResponse);
  if (firstResult !== null) return firstResult;

  console.warn(`[llmJsonParse] ${description}: first attempt returned invalid JSON, retrying...`);

  // Second attempt - append explicit JSON instruction
  const retryMessages: Message[] = [
    ...messages,
    {
      role: "assistant" as const,
      content: firstResponse,
    },
    {
      role: "user" as const,
      content: "You must return valid JSON only. No preamble, no markdown code blocks, no explanation outside the JSON object or array. Return only the raw JSON.",
    },
  ];

  // Retry with a shorter timeout than the first attempt to limit total wait
  const secondResponse = await chatComplete(retryMessages, maxTokens, Math.max(30_000, Math.floor(timeoutMs / 2)), model, { preserveVerbatim });
  const secondResult = tryParseJson<T>(secondResponse);
  if (secondResult !== null) return secondResult;

  // Both failed
  console.error(`[llmJsonParse] ${description}: both attempts returned invalid JSON`);
  console.error(`[llmJsonParse] Last response: ${secondResponse.slice(0, 500)}`);
  throw new Error(`LLM returned invalid JSON after retry (${description})`);
}

function tryParseJson<T>(text: string): T | null {
  // Try direct parse first (handles arrays and objects equally)
  try {
    return JSON.parse(text) as T;
  } catch { /* fall through */ }

  // Try extracting JSON object first. The outermost object is usually the intended result.
  // Objects take priority over arrays because LLMs sometimes include arrays as fields inside objects.
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) as T; } catch { /* fall through */ }
  }

  // Try extracting JSON array (fallback, e.g. when LLM returns a bare array)
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]) as T; } catch { /* fall through */ }
  }

  return null;
}
