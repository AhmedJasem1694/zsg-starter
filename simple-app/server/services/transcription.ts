import OpenAI from "openai";
import fs from "fs";

// Uses OpenAI directly (not OpenRouter) for Whisper
// Falls back gracefully if OPENAI_API_KEY is not set
export async function transcribeAudioFile(filePath: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[transcription] OPENAI_API_KEY not set — skipping transcription");
    return null;
  }

  const client = new OpenAI({ apiKey });

  try {
    const audioFile = fs.createReadStream(filePath);
    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "text",
    });
    return typeof transcription === "string" ? transcription : null;
  } catch (err) {
    console.error("[transcription] Whisper API error:", err);
    return null;
  }
}
