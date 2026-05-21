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
}

export async function llmJsonCall<T>(opts: LLMJsonOptions): Promise<T> {
  const { messages, maxTokens, description = "LLM call" } = opts;

  // First attempt
  const firstResponse = await chatComplete(messages, maxTokens);
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

  // Retry with a 30s timeout (shorter than the first attempt) to limit total wait
  const secondResponse = await chatComplete(retryMessages, maxTokens, 30_000);
  const secondResult = tryParseJson<T>(secondResponse);
  if (secondResult !== null) return secondResult;

  // Both failed
  console.error(`[llmJsonParse] ${description}: both attempts returned invalid JSON`);
  console.error(`[llmJsonParse] Last response: ${secondResponse.slice(0, 500)}`);
  throw new Error(`LLM returned invalid JSON after retry (${description})`);
}

function tryParseJson<T>(text: string): T | null {
  // Try direct parse first
  try {
    return JSON.parse(text) as T;
  } catch { /* fall through */ }

  // Try extracting JSON object
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) as T; } catch { /* fall through */ }
  }

  // Try extracting JSON array
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]) as T; } catch { /* fall through */ }
  }

  return null;
}
