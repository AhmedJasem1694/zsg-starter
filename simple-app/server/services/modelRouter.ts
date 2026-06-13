/**
 * Model Router, selects the best AI model for each analysis task.
 *
 * All calls go through OpenRouter using the same API key.
 * Task callers never specify a model directly. They specify a task name.
 * This module decides which model handles each task.
 *
 * Assignments per the June 2026 legalbenchmarks.ai leaderboard:
 * - Classification / doc-type detection: Gemini Flash (~$0.08/task, strong
 *   reliability for the price).
 * - Metadata & structured extraction: consolidated onto Claude Sonnet 4.6
 *   ($0.13/task). Benchmark shows GPT-5.5 weak on drafting and only marginal
 *   on extraction. Fewer vendors, simpler.
 * - Clause analysis, playbook comparison, fallback language: Claude Sonnet 4.6.
 * - Hard reasoning ONLY (contradiction detection, escalation analysis,
 *   low-confidence reanalysis): Claude Opus 4.8 (~$0.29/task, benchmark
 *   leader on legal reliability). Do NOT use Fable 5: costs 2x+ Opus without
 *   beating it on legal work. Routine clauses must never reach Opus. See the
 *   confidence gate in reviewOrchestrator.
 */

export type AnalysisTask =
  | "document_classification"
  | "metadata_extraction"
  | "clause_extraction"
  | "playbook_comparison"
  | "regulatory_citation"
  | "fallback_generation"
  | "contradiction_detection"
  | "escalation_analysis"
  | "pattern_intelligence"
  | "defined_terms_audit"
  | "cross_reference_check"
  | "low_confidence_reanalysis";

const MODEL_MAP: Record<AnalysisTask, string> = {
  // Gemini Flash, fast first-pass triage, cheap and low-latency
  document_classification:   "google/gemini-3.5-flash",

  // Claude Sonnet 4.6, structured extraction (consolidated off GPT-4o/GPT-5.5)
  metadata_extraction:       "anthropic/claude-sonnet-4-6",
  defined_terms_audit:       "anthropic/claude-sonnet-4-6",
  cross_reference_check:     "anthropic/claude-sonnet-4-6",

  // Claude Sonnet 4.6, primary legal reasoning workhorse
  clause_extraction:         "anthropic/claude-sonnet-4-6",
  playbook_comparison:       "anthropic/claude-sonnet-4-6",
  regulatory_citation:       "anthropic/claude-sonnet-4-6",
  fallback_generation:       "anthropic/claude-sonnet-4-6",
  pattern_intelligence:      "anthropic/claude-sonnet-4-6",

  // Claude Opus 4.8, hard reasoning ONLY
  contradiction_detection:   "anthropic/claude-opus-4-8",
  escalation_analysis:       "anthropic/claude-opus-4-8",
  low_confidence_reanalysis: "anthropic/claude-opus-4-8",
};

/**
 * Returns the OpenRouter model string for a given analysis task.
 * Falls back to Claude Sonnet if the task is unrecognised.
 */
export function getModelForTask(task: AnalysisTask): string {
  return MODEL_MAP[task] ?? "anthropic/claude-sonnet-4-6";
}

/** Human-readable label for logs and audit trails */
export function getModelLabel(model: string): string {
  const labels: Record<string, string> = {
    "google/gemini-3.5-flash":       "Gemini 3.5 Flash",
    "anthropic/claude-sonnet-4-6":   "Claude Sonnet",
    "anthropic/claude-opus-4-8":     "Claude Opus",
    // Legacy ids, kept so old audit records still resolve a label
    "google/gemini-2.5-flash":       "Gemini 2.5 Flash",
    "openai/gpt-4o":                 "GPT-4o",
    "anthropic/claude-sonnet-4-5":   "Claude Sonnet 4.5",
    "anthropic/claude-opus-4-6":     "Claude Opus 4.6",
  };
  return labels[model] ?? model;
}

// ─── Cost rates (USD per 1M tokens) for review_cost estimation ───────────────
// Used by costTracker to turn OpenRouter usage responses into a per-run cost
// estimate. Rates are list prices; OpenRouter passes provider pricing through.

export interface ModelRates {
  /** USD per 1M input tokens */
  inputPerMTok: number;
  /** USD per 1M output tokens */
  outputPerMTok: number;
}

const MODEL_RATES: Record<string, ModelRates> = {
  "anthropic/claude-sonnet-4-6": { inputPerMTok: 3.0,  outputPerMTok: 15.0 },
  "anthropic/claude-opus-4-8":   { inputPerMTok: 5.0,  outputPerMTok: 25.0 },
  "google/gemini-3.5-flash":     { inputPerMTok: 0.30, outputPerMTok: 2.50 },
  // Legacy ids, old pipelines / env overrides
  "anthropic/claude-sonnet-4-5": { inputPerMTok: 3.0,  outputPerMTok: 15.0 },
  "anthropic/claude-opus-4-6":   { inputPerMTok: 5.0,  outputPerMTok: 25.0 },
  "google/gemini-2.5-flash":     { inputPerMTok: 0.30, outputPerMTok: 2.50 },
  "openai/gpt-4o":               { inputPerMTok: 2.50, outputPerMTok: 10.0 },
};

/** Rates for a model; unknown models assume Sonnet-tier pricing (conservative). */
export function getModelRates(model: string): ModelRates {
  return MODEL_RATES[model] ?? { inputPerMTok: 3.0, outputPerMTok: 15.0 };
}
