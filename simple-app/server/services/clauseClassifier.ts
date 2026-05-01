import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";

export const CLAUSE_CATEGORIES = [
  "LIABILITY_CAP",
  "INDEMNITY",
  "IP_OWNERSHIP",
  "CONFIDENTIALITY",
  "DATA_PRIVACY",
  "TERMINATION",
  "PAYMENT_TERMS",
  "AUTO_RENEWAL",
  "GOVERNING_LAW",
  "AUDIT_RIGHTS",
  "FORCE_MAJEURE",
  "WARRANTIES",
  "DISPUTE_RESOLUTION",
  "ASSIGNMENT",
  "INSURANCE",
  "NON_SOLICITATION",
  "EXCLUSIVITY",
  "CHANGE_OF_CONTROL",
  "RENT_REVIEW",
  "BREAK_CLAUSE",
  "REPAIR_OBLIGATIONS",
  "SERVICE_CHARGE",
  "ENTIRE_AGREEMENT",
  "VARIATION",
  "WAIVER",
  "SEVERABILITY",
  "NOTICES",
  "THIRD_PARTY_RIGHTS",
  "SET_OFF",
  "LIQUIDATED_DAMAGES",
  "MOST_FAVOURED_NATION",
  "BENCHMARKING",
  "STEP_IN_RIGHTS",
  "SUBCONTRACTING",
  "BUSINESS_CONTINUITY",
  "SERVICE_LEVELS",
  "SOURCE_CODE_ESCROW",
  "MARKETING_RIGHTS",
  "ANTI_BRIBERY",
  "SANCTIONS_COMPLIANCE",
  "MODERN_SLAVERY",
  "ENVIRONMENTAL_OBLIGATIONS",
  "TUPE",
  "RESTRICTIVE_COVENANTS",
  "ACCEPTANCE_TESTING",
  "REGULATORY_CHANGE",
  "CONTENT_MODERATION",
  "VIRTUAL_ITEMS",
  "PLATFORM_REVENUE_SHARE",
  "LOOT_BOX_MECHANICS",
  // Investment document clauses
  "LIQUIDATION_PREFERENCE",
  "ANTI_DILUTION",
  "PRO_RATA_RIGHTS",
  "DRAG_ALONG",
  "INFORMATION_RIGHTS",
  "BOARD_COMPOSITION",
  "VESTING_LEAVER",
  "OPTION_POOL_SHUFFLE",
  "PAY_TO_PLAY",
  "REDEMPTION_RIGHTS",
] as const;

export type ClauseCategory = (typeof CLAUSE_CATEGORIES)[number];

export interface ClassifiedChunk {
  category: ClauseCategory;
  rawText: string;
  confidence: number;
}

export async function classifyClauses(
  chunks: string[]
): Promise<ClassifiedChunk[]> {
  const categoriesDesc = CLAUSE_CATEGORIES.join(" | ");

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "system",
        content: `You are a legal clause classifier. Classify contract text chunks into these categories: ${categoriesDesc}.
Return ONLY a JSON array. Each element: {"chunkIndex": number, "category": string, "confidence": number (0-1)}.
If a chunk clearly matches a category, set confidence >= 0.8. If uncertain, set confidence 0.5-0.79.
If a chunk does not match any category, omit it from results.`,
      },
      {
        role: "user",
        content: `Classify these contract text chunks:\n\n${chunks
          .map((c, i) => `[${i}] ${c}`)
          .join("\n\n---\n\n")}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      chunkIndex: number;
      category: string;
      confidence: number;
    }>;

    return parsed
      .filter(
        (item) =>
          item.chunkIndex < chunks.length &&
          CLAUSE_CATEGORIES.includes(item.category as ClauseCategory)
      )
      .map((item) => ({
        category: item.category as ClauseCategory,
        rawText: chunks[item.chunkIndex],
        confidence: item.confidence,
      }));
  } catch {
    return [];
  }
}
