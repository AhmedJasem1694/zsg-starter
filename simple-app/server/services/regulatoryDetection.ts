import { chatComplete } from "./openrouter.js";
import { pb } from "../pb.js";
import {
  detectFrameworks,
  REGULATORY_FRAMEWORKS,
  type Jurisdiction,
} from "../data/regulatoryFrameworks.js";
import { getRegulatorySource, hasRegulatorySource } from "../data/regulatorySources.js";

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
  const company = await pb.collection("companies").getOne(companyId);

  const jurisdictions = mapJurisdiction(company["jurisdiction"] as string);

  // Step 1: keyword-based detection
  const keywordMatches = detectFrameworks(company["sector"] as string, jurisdictions);

  // Step 2: AI enhancement - find any the keyword match missed
  let aiCodes: string[] = [];
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== "your-api-key-here") {
    try {
      const allCodes = REGULATORY_FRAMEWORKS.map((f) => f.code).join(", ");
      const text = await chatComplete(
        [
          {
            role: "user",
            content: `A company called "${company["name"]}" operates in the "${company["sector"]}" sector, based in "${company["jurisdiction"]}".

Given these regulatory framework codes: ${allCodes}

Return ONLY a JSON array of framework codes (strings) that are likely to apply to this company, beyond obvious matches. Focus on non-obvious regulatory overlaps. Return empty array if nothing additional applies.

Example: ["GB_FCA_CONSUMER_DUTY", "EU_AI_ACT"]`,
          },
        ],
        512
      );
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
  // Only persist frameworks that have verifiable source data. Without an
  // official instrument name, reference number, issuing body, and citation
  // link, a framework is never surfaced as review context or displayed.
  const allFrameworks = [...keywordMatches, ...aiFrameworks].filter((f) => hasRegulatorySource(f.code));

  // Clear existing regulations for this company.
  // Use individual .catch(() => {}) so concurrent detection runs (e.g. the async
  // kick-off from POST /api/company overlapping with POST /api/regulatory/detect)
  // don't throw when a record has already been deleted by the other run.
  const existing = await pb.collection("company_regulations").getFullList({
    filter: `company = "${companyId}"`,
    fields: "id",
  });
  await Promise.all(existing.map((r) => pb.collection("company_regulations").delete(r.id).catch(() => {})));

  // Save new regulations
  if (allFrameworks.length > 0) {
    await Promise.all(
      allFrameworks.map((f) => {
        const src = getRegulatorySource(f.code)!;
        return pb.collection("company_regulations").create({
          company: companyId,
          jurisdiction: f.jurisdiction,
          regulator: f.regulator,
          frameworkName: f.frameworkName,
          description: f.description,
          appliesTo: f.sectorTags.join(", "),
          code: f.code,
          officialName: src.officialName,
          referenceNumber: src.referenceNumber,
          issuingBody: src.issuingBody,
          citationUrl: src.citationUrl,
        });
      })
    );
  }
}

export async function getRegulationSummaryForLLM(companyId: string): Promise<string> {
  const regs = await pb.collection("company_regulations").getFullList({
    filter: `company = "${companyId}"`,
    sort: "+jurisdiction",
  });

  // Only frameworks with verifiable source data are used as review context.
  const sourced = regs.filter((r) => hasRegulatorySource(r["code"] as string));
  if (sourced.length === 0) return "";

  const lines = sourced.map((r) => {
    const framework = REGULATORY_FRAMEWORKS.find((f) => f.frameworkName === r["frameworkName"]);
    const obligations = framework?.keyObligations.slice(0, 3).join("; ") ?? "";
    const ref = r["referenceNumber"] ? `, ${r["referenceNumber"]}` : "";
    return `- ${r["frameworkName"]} (${r["issuingBody"] || r["regulator"]}, ${r["jurisdiction"]}${ref}): ${r["description"]} Key obligations: ${obligations} [Source: ${r["citationUrl"]}]`;
  });

  return `\n\nApplicable regulatory frameworks for this company (curated, source-cited context only):\n${lines.join("\n")}`;
}
