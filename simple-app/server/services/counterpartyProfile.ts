/**
 * Vendor-specific negotiation intelligence (Section 3c / 3d).
 *
 * Aggregates every captured `negotiation_events` row for a counterparty (across
 * all their threads and contracts) into a profile: which clauses they always
 * push on, how far they typically move, what they never concede, and the average
 * number of rounds it takes them to close.
 *
 * The profile is surfaced on the playbook's counterparty intelligence section and
 * on the contract review for any contract with that counterparty (3c), and is fed
 * into the email review output and into first-draft "TO CONFIRM" notes (3d).
 */

import { pb } from "../pb.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export interface CounterpartyClauseStat {
  category: string;
  moves: number;
  threads: number;
  theyProposed: number;
  weAccepted: number;   // outcomes where they accepted our position
  theyRejected: number; // outcomes where they rejected our position
}

export interface CounterpartyProfile {
  counterparty: string;
  contracts: number;
  threads: number;
  totalMoves: number;
  avgRoundsToClose: number | null;
  alwaysPushOn: string[];      // clause categories
  neverConcede: string[];      // clause categories they never give our position on
  typicalMovement: string;     // human-readable summary
  clauseStats: CounterpartyClauseStat[];
  summaryLines: string[];      // ready-to-render bullet lines
}

const label = (c: string) =>
  (c ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());

/** Pull every negotiation_events row for a counterparty within a company. */
async function loadEvents(companyId: string, counterparty: string): Promise<PBRecord[]> {
  const cp = counterparty.trim().replace(/"/g, "");
  if (!cp) return [];
  try {
    return await pb.collection("negotiation_events").getFullList({
      filter: `company = "${companyId}" && counterparty = "${cp}"`,
      sort: "created",
    });
  } catch {
    return []; // collection may not exist yet
  }
}

/**
 * Build a counterparty profile, or null if there isn't enough captured data to
 * say anything meaningful (we never speculate beyond what was captured, 3e).
 */
export async function buildCounterpartyProfile(
  companyId: string,
  counterparty: string,
): Promise<CounterpartyProfile | null> {
  const events = await loadEvents(companyId, counterparty);
  if (events.length < 2) return null;

  const contracts = new Set<string>();
  const threads = new Set<string>();
  const byCat = new Map<string, CounterpartyClauseStat>();
  // thread_id -> max round seen, and whether it reached a landing
  const threadRounds = new Map<string, { maxRound: number; closed: boolean }>();

  let accepted = 0, rejected = 0, countered = 0;

  for (const e of events) {
    const cat = String(e["clause_category"] ?? "").trim();
    const contract = String(e["contract"] ?? "");
    const thread = String(e["thread_id"] ?? "") || contract;
    const proposer = String(e["proposer"] ?? "");
    const outcome = String(e["outcome"] ?? "");
    const round = Number(e["round"]) || 1;
    const landing = String(e["final_landing"] ?? "").trim();

    if (contract) contracts.add(contract);
    if (thread) threads.add(thread);

    if (outcome === "accepted") accepted++;
    else if (outcome === "rejected") rejected++;
    else if (outcome === "countered") countered++;

    const tr = threadRounds.get(thread) ?? { maxRound: 0, closed: false };
    tr.maxRound = Math.max(tr.maxRound, round);
    if (outcome === "accepted" || outcome === "rejected" || landing) tr.closed = true;
    threadRounds.set(thread, tr);

    if (!cat) continue;
    const stat = byCat.get(cat) ?? { category: cat, moves: 0, threads: 0, theyProposed: 0, weAccepted: 0, theyRejected: 0 };
    stat.moves++;
    if (proposer === "counterparty") stat.theyProposed++;
    if (outcome === "accepted") stat.weAccepted++;
    if (outcome === "rejected") stat.theyRejected++;
    byCat.set(cat, stat);
  }

  // distinct-thread counts per category
  const catThreads = new Map<string, Set<string>>();
  for (const e of events) {
    const cat = String(e["clause_category"] ?? "").trim();
    const thread = String(e["thread_id"] ?? "") || String(e["contract"] ?? "");
    if (!cat) continue;
    (catThreads.get(cat) ?? catThreads.set(cat, new Set()).get(cat)!).add(thread);
  }
  for (const [cat, set] of Array.from(catThreads.entries())) {
    const stat = byCat.get(cat);
    if (stat) stat.threads = set.size;
  }

  const clauseStats = Array.from(byCat.values()).sort((a, b) => b.moves - a.moves);

  // "Always push on": clauses they proposed/moved on in 2+ distinct threads, or
  // in every thread we have for them.
  const alwaysPushOn = clauseStats
    .filter((s) => s.theyProposed > 0 && (s.threads >= 2 || s.threads === threads.size))
    .map((s) => s.category);

  // "Never concede": clauses with 2+ moves where they never accepted our
  // position and have rejected it at least once.
  const neverConcede = clauseStats
    .filter((s) => s.moves >= 2 && s.weAccepted === 0 && s.theyRejected > 0)
    .map((s) => s.category);

  // Average rounds to close, across threads that actually reached a landing.
  const closedThreads = Array.from(threadRounds.values()).filter((t) => t.closed);
  const roundsBasis = closedThreads.length > 0 ? closedThreads : Array.from(threadRounds.values());
  const avgRoundsToClose = roundsBasis.length > 0
    ? Math.round((roundsBasis.reduce((a, t) => a + t.maxRound, 0) / roundsBasis.length) * 10) / 10
    : null;

  // Typical movement summary from the outcome mix.
  let typicalMovement: string;
  const decisive = accepted + rejected + countered;
  if (decisive === 0) typicalMovement = "negotiates but rarely lands a clear position on record";
  else if (rejected >= accepted && rejected >= countered) typicalMovement = "holds firm, rarely moves off their position";
  else if (accepted > rejected && accepted >= countered) typicalMovement = "tends to accept reasonable positions";
  else typicalMovement = "counters, then settles toward the middle";

  const summaryLines: string[] = [];
  if (alwaysPushOn.length) summaryLines.push(`Consistently pushes on: ${alwaysPushOn.map(label).join(", ")}.`);
  if (neverConcede.length) summaryLines.push(`Rarely concedes: ${neverConcede.map(label).join(", ")}.`);
  summaryLines.push(`Typically ${typicalMovement}.`);
  if (avgRoundsToClose != null) summaryLines.push(`Averages ${avgRoundsToClose} round(s) to close.`);

  return {
    counterparty: counterparty.trim(),
    contracts: contracts.size,
    threads: threads.size,
    totalMoves: events.length,
    avgRoundsToClose,
    alwaysPushOn,
    neverConcede,
    typicalMovement,
    clauseStats,
    summaryLines,
  };
}

/** A compact note for the review output (3d). Empty string when no profile. */
export function profileReviewNote(profile: CounterpartyProfile | null): string {
  if (!profile) return "";
  return `Known negotiation patterns with ${profile.counterparty} (from ${profile.totalMoves} captured move(s) across ${profile.contracts} contract(s)):\n` +
    profile.summaryLines.map((l) => `  • ${l}`).join("\n");
}

/**
 * Pre-empt a known counterparty's likely pushback as TO CONFIRM items for a
 * first draft (3d). These go in the draft NOTES, never the draft text.
 */
export function profileDraftToConfirm(profile: CounterpartyProfile | null): string[] {
  if (!profile) return [];
  const items: string[] = [];
  for (const cat of profile.alwaysPushOn) {
    items.push(`${label(cat)}: ${profile.counterparty} consistently pushes on this. Confirm your fallback before sending.`);
  }
  for (const cat of profile.neverConcede) {
    if (profile.alwaysPushOn.includes(cat)) continue;
    items.push(`${label(cat)}: ${profile.counterparty} rarely concedes here. Confirm whether to lead with your fallback.`);
  }
  return items;
}
