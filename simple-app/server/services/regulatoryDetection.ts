import OpenAI from "openai";
import { prisma } from "../db.js";
import {
  detectFrameworks,
  REGULATORY_FRAMEWORKS,
  type Jurisdiction,
} from "../data/regulatoryFrameworks.js";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";

// Map jurisdiction strings from onboarding to our codes
function mapJurisdiction(jurisdiction: string): Jurisdiction[] {
  const j = jurisdiction.toLowerCase();
  const result: Jurisdiction[] = [];

  if (j.includes("england") || j.includes("uk") || j.includes("wales") || j.includes("scotland") || j.includes("britain"))
    result.push("GB");
  if (j.includes("eu") || j.includes("europe") || j.includes("european") || j.includes("ireland") || j.includes("netherlands") || j.includes("dutch") || j.includes("holland"))
    result.push("EU");
  if (j.includes("ireland") || j.includes("ie ") || j === "ie")
    result.push("IE");
  if (j.includes("netherlands") || j.includes("dutch") || j.includes("holland") || j.includes("nl ") || j === "nl")
    result.push("NL");
  if (j.includes("us") || j.includes("united states") || j.includes("america") || j.includes("california") || j.includes("new york") || j.includes("delaware"))
    result.push("US");
  if (j.includes("singapore") || j.includes("sg"))
    result.push("SG");
  if (j.includes("uae") || j.includes("dubai") || j.includes("abu dhabi") || j.includes("difc") || j.includes("adgm") || j.includes("emirates"))
    result.push("AE");
  if (j.includes("switzerland") || j.includes("swiss") || j.includes("zurich") || j.includes("geneva") || j.includes("ch ") || j === "ch")
    result.push("CH");
  if (j.includes("hong kong") || j.includes("hksar") || j.includes("hk ") || j === "hk")
    result.push("HK");
  if (j.includes("japan") || j.includes("japanese") || j.includes("tokyo") || j.includes("jp ") || j === "jp")
    result.push("JP");
  if (j.includes("canada") || j.includes("canadian") || j.includes("ontario") || j.includes("british columbia"))
    result.push("CA");
  if (j.includes("saudi") || j.includes("ksa") || j.includes("riyadh"))
    result.push("KSA");
  if (j.includes("korea") || j.includes("korean") || j.includes("seoul") || j.includes("kr ") || j === "kr")
    result.push("KR");
  if (j.includes("india") || j.includes("indian") || j.includes("mumbai") || j.includes("delhi") || j.includes("bangalore") || j.includes("bengaluru") || j.includes("in ") || j === "in")
    result.push("IN");
  if (j.includes("brazil") || j.includes("brasil") || j.includes("brazilian") || j.includes("são paulo") || j.includes("sao paulo") || j.includes("rio") || j.includes("br ") || j === "br")
    result.push("BR");

  // Default: include GB + EU if none matched
  if (result.length === 0) result.push("GB", "EU");

  return result;
}

export async function detectAndSaveRegulations(companyId: string): Promise<void> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
  });

  const jurisdictions = mapJurisdiction(company.jurisdiction);

  // Step 1: keyword-based detection
  const keywordMatches = detectFrameworks(company.sector, jurisdictions);

  // Step 2: AI enhancement - find any the keyword match missed
  let aiCodes: string[] = [];
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== "your-api-key-here") {
    try {
      const allCodes = REGULATORY_FRAMEWORKS.map((f) => f.code).join(", ");
      const response = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `A company called "${company.name}" operates in the "${company.sector}" sector, based in "${company.jurisdiction}".

Given these regulatory framework codes: ${allCodes}

Return ONLY a JSON array of framework codes (strings) that are likely to apply to this company, beyond obvious matches. Focus on non-obvious regulatory overlaps. Return empty array if nothing additional applies.

Example: ["GB_FCA_CONSUMER_DUTY", "EU_AI_ACT"]`,
          },
        ],
      });
      const text = response.choices[0]?.message?.content ?? "";
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) aiCodes = JSON.parse(match[0]) as string[];
    } catch {
      // AI enhancement is best-effort; fall through to keyword results
    }
  }

  // Merge keyword + AI results, deduplicate
  const aiFrameworks = REGULATORY_FRAMEWORKS.filter(
    (f) => aiCodes.includes(f.code) && !keywordMatches.find((k) => k.code === f.code)
  );
  const allFrameworks = [...keywordMatches, ...aiFrameworks];

  // Clear existing and save new
  await prisma.companyRegulation.deleteMany({ where: { companyId } });

  if (allFrameworks.length > 0) {
    await prisma.companyRegulation.createMany({
      data: allFrameworks.map((f) => ({
        companyId,
        jurisdiction: f.jurisdiction,
        regulator: f.regulator,
        frameworkName: f.frameworkName,
        description: f.description,
        appliesTo: f.sectorTags.join(", "),
      })),
    });
  }
}

export async function getRegulationSummaryForLLM(companyId: string): Promise<string> {
  const regs = await prisma.companyRegulation.findMany({
    where: { companyId },
    orderBy: { jurisdiction: "asc" },
  });

  if (regs.length === 0) return "";

  const lines = regs.map((r) => {
    const framework = REGULATORY_FRAMEWORKS.find((f) => f.frameworkName === r.frameworkName);
    const obligations = framework?.keyObligations.slice(0, 3).join("; ") ?? "";
    return `- ${r.frameworkName} (${r.regulator}, ${r.jurisdiction}): ${r.description} Key obligations: ${obligations}`;
  });

  return `\n\nApplicable regulatory frameworks for this company:\n${lines.join("\n")}`;
}
