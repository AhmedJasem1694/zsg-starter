import { transcribeAudio } from "./openrouter.js";

export async function transcribeAudioFile(filePath: string): Promise<string | null> {
  return transcribeAudio(filePath);
}
