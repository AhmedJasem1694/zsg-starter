/**
 * Shared OpenRouter client - native fetch, no OpenAI SDK.
 *
 * All LLM calls in the app go through here.
 * Set OPENROUTER_API_KEY in your environment.
 * Optionally override the model with OPENROUTER_MODEL.
 */

const BASE_URL = "https://openrouter.ai/api/v1";

export const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  choices: Array<{
    message: { content: string };
  }>;
}

export async function chatComplete(
  messages: Message[],
  maxTokens = 1024,
  timeoutMs = 60_000 // 60s per attempt — llmJsonCall may retry once, so total max ~90s
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages,
      }),
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new Error(`OpenRouter request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body}`);
  }

  const data = await res.json() as ChatResponse;
  return data.choices[0]?.message?.content ?? "";
}

/**
 * Audio transcription via OpenRouter.
 * OpenRouter proxies Whisper-compatible audio transcription.
 * Returns null (graceful skip) if the API key is missing or the call fails.
 */
export async function transcribeAudio(filePath: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[transcription] OPENROUTER_API_KEY not set - skipping transcription");
    return null;
  }

  const { default: fs } = await import("fs");
  const { default: path } = await import("path");

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer]), fileName);
  formData.append("model", "openai/whisper-large-v3");

  try {
    const res = await fetch(`${BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      console.error("[transcription] OpenRouter audio error:", res.status, await res.text());
      return null;
    }

    // OpenRouter may return JSON { text: "..." } or plain text
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await res.json() as { text?: string };
      return json.text ?? null;
    }
    return await res.text() || null;
  } catch (err) {
    console.error("[transcription] Error:", err);
    return null;
  }
}
