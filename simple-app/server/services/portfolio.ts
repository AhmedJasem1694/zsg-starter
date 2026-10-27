/**
 * Portfolio risk aggregation.
 *
 * Lifted out of the GET /api/portfolio handler unchanged. It was inline in the
 * route, which was fine while a signed-in request was the only thing that
 * wanted it. The scheduled monthly report also needs it, and it has no request
 * and no user, so the choice was to export this or to write a second
 * implementation of "red-flag exposure" for the email. A second implementation
 * of a money figure that a CFO reads in two places is not a choice.
 *
 * Takes a company id and nothing else, so it is callable from a route, a
 * background loop or a script. Returns null when the company has no completed
 * reviews, which the route serves as JSON null and the report treats as
 * nothing to send.
 */

import { pb } from "../pb.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

const GROUPS = [
  { label: "Liability & Risk",      icon: "⚖️",  cats: ["LIABILITY_CAP","INDEMNITY","WARRANTIES","LIQUIDATED_DAMAGES","INSURANCE"] },
  { label: "Data & Privacy",        icon: "🔐",  cats: ["DATA_PRIVACY","CONFIDENTIALITY","SANCTIONS_COMPLIANCE","MODERN_SLAVERY","ANTI_BRIBERY"] },
  { label: "IP & Technology",       icon: "💡",  cats: ["IP_OWNERSHIP","SOURCE_CODE_ESCROW","ACCEPTANCE_TESTING","MARKETING_RIGHTS","SERVICE_LEVELS"] },
  { label: "Termination & Renewal", icon: "📅",  cats: ["TERMINATION","AUTO_RENEWAL","BREAK_CLAUSE","CHANGE_OF_CONTROL","REGULATORY_CHANGE"] },
];

export interface PortfolioPayload {
  groups: Array<{ label: string; icon: string; red: number; amber: number; green: number }>;
  topRedCategories: Array<{ category: string; count: number; pct: number }>;
  byContractType: Array<{ type: string; red: number; amber: number; total: number }>;
  insight: string;
  totalDocuments: number;
  totalClauses: number;
  totalRedResults: number;
  escalationsOpen: number;
  totalValue: number;
  signedDocs: number;
  byCounterparty: Array<{ name: string; red: number; amber: number; green: number; total: number; value: number }>;
  valueAtRisk: { RED: number; AMBER: number; GREEN: number; total: number };
}

export async function computePortfolio(companyId: string): Promise<PortfolioPayload | null> {
  const completeDocs = await pb.collection("uploaded_documents").getFullList({
    filter: `company = "${companyId}" && status = "COMPLETE"`,
    fields: "id,contractType,counterpartyName,contractValue,currency,outcome",
  });

  const completeDocIds = completeDocs.map((d) => d.id);
  const completeDocFilter = completeDocIds.length > 0
    ? completeDocIds.map((id) => `document = "${id}"`).join(" || ")
    : `id = "none"`;

  const [results, allEscalations] = await Promise.all([
    pb.collection("review_results").getFullList({
      filter: completeDocFilter,
    }).catch(() => [] as PBRecord[]),
    pb.collection("review_results").getFullList({
      filter: `${completeDocFilter} && escalationRequired = true`,
      fields: "id,document",
    }).catch(() => [] as PBRecord[]),
  ]);

  if (results.length === 0) return null;

  const docMeta = new Map(completeDocs.map((d) => [d.id, {
    contractType: d["contractType"] as string,
    counterpartyName: d["counterpartyName"] as string | null,
    contractValue: d["contractValue"] as number | null,
    currency: (d["currency"] as string) || "GBP",
    outcome: d["outcome"] as string | null,
  }]));

  const groups = GROUPS.map((g) => {
    const gr = results.filter((r) => g.cats.includes(r["clauseCategory"] as string));
    return {
      label: g.label,
      icon:  g.icon,
      red:   gr.filter((r) => r["ragStatus"] === "RED").length,
      amber: gr.filter((r) => r["ragStatus"] === "AMBER").length,
      green: gr.filter((r) => r["ragStatus"] === "GREEN").length,
    };
  });

  const totalDocs = new Set(results.map((r) => r["document"] as string)).size;
  const totalRedResults = results.filter((r) => r["ragStatus"] === "RED").length;
  const escalationsOpen = new Set(allEscalations.map((r) => r["document"] as string)).size;
  const totalValue = completeDocs.reduce((acc, d) => acc + ((d["contractValue"] as number | null) ?? 0), 0);
  const signedDocs = completeDocs.filter((d) => d["outcome"] === "SIGNED" || d["outcome"] === "EXECUTED").length;

  const categoryRed: Record<string, number> = {};
  const categoryTotal: Record<string, number> = {};
  for (const r of results) {
    const cat = r["clauseCategory"] as string;
    categoryTotal[cat] = (categoryTotal[cat] ?? 0) + 1;
    if (r["ragStatus"] === "RED") categoryRed[cat] = (categoryRed[cat] ?? 0) + 1;
  }
  const topRedCategories = Object.entries(categoryRed)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([category, count]) => ({ category, count, pct: Math.round((count / totalDocs) * 100) }));

  const typeMap: Record<string, { red: number; amber: number; docIds: Set<string> }> = {};
  for (const r of results) {
    const docId = r["document"] as string;
    const t = docMeta.get(docId)?.contractType ?? "UNKNOWN";
    if (!typeMap[t]) typeMap[t] = { red: 0, amber: 0, docIds: new Set() };
    typeMap[t].docIds.add(docId);
    if (r["ragStatus"] === "RED")   typeMap[t].red++;
    if (r["ragStatus"] === "AMBER") typeMap[t].amber++;
  }
  const byContractType = Object.entries(typeMap)
    .map(([type, v]) => ({ type: type.replace(/_/g, " "), red: v.red, amber: v.amber, total: v.docIds.size }))
    .sort((a, b) => b.red - a.red);

  // Counterparty risk heat map - top 8 counterparties by red count
  const cpMap: Record<string, { red: number; amber: number; green: number; docIds: Set<string>; value: number }> = {};
  for (const r of results) {
    const docId = r["document"] as string;
    const meta = docMeta.get(docId);
    const cp = meta?.counterpartyName || "Unknown";
    if (!cpMap[cp]) cpMap[cp] = { red: 0, amber: 0, green: 0, docIds: new Set(), value: 0 };
    cpMap[cp].docIds.add(docId);
    if (r["ragStatus"] === "RED")   cpMap[cp].red++;
    if (r["ragStatus"] === "AMBER") cpMap[cp].amber++;
    if (r["ragStatus"] === "GREEN") cpMap[cp].green++;
  }
  for (const [, v] of Object.entries(cpMap)) {
    Array.from(v.docIds).forEach((docId) => {
      v.value += docMeta.get(docId)?.contractValue ?? 0;
    });
  }
  const byCounterparty = Object.entries(cpMap)
    .map(([name, v]) => ({
      name,
      red: v.red, amber: v.amber, green: v.green,
      total: v.docIds.size,
      value: v.value,
    }))
    .sort((a, b) => b.red - a.red)
    .slice(0, 8);

  // Value at risk by RAG band
  // For each doc, determine its "worst" RAG: if any RED → RED, else if any AMBER → AMBER, else GREEN
  const docRag: Record<string, "RED" | "AMBER" | "GREEN"> = {};
  for (const r of results) {
    const docId = r["document"] as string;
    const rag = r["ragStatus"] as string;
    const cur = docRag[docId];
    if (!cur || (rag === "RED") || (rag === "AMBER" && cur === "GREEN")) {
      docRag[docId] = rag as "RED" | "AMBER" | "GREEN";
    }
  }
  const valueAtRisk = { RED: 0, AMBER: 0, GREEN: 0, total: 0 };
  for (const [docId, rag] of Object.entries(docRag)) {
    const v = docMeta.get(docId)?.contractValue ?? 0;
    valueAtRisk[rag] += v;
    valueAtRisk.total += v;
  }

  const topCat = topRedCategories[0];
  const insight = topCat
    ? `${topCat.category.replace(/_/g, " ")} is your most common risk issue across ${totalDocs} reviewed contract${totalDocs !== 1 ? "s" : ""}. Check your playbook position and consider whether your red line is calibrated correctly.`
    : `${totalDocs} contract${totalDocs !== 1 ? "s" : ""} reviewed with no RED flags. Your playbook positions are holding well.`;

  return {
    groups, topRedCategories, byContractType, insight,
    totalDocuments: totalDocs, totalClauses: results.length,
    totalRedResults, escalationsOpen, totalValue, signedDocs,
    byCounterparty, valueAtRisk,
  };
}
