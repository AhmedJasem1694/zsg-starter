/**
 * Model Router — selects the best AI model for each analysis task.
 *
 * All calls go through OpenRouter using the same API key.
 * Task callers never specify a model directly — they specify a task name.
 * This module decides which model handles each task.
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
  // Gemini Flash — fast first-pass triage, cheap and low-latency
  document_classification:   "google/gemini-2.5-flash",

  // GPT-4o — structured extraction from long documents
  metadata_extraction:       "openai/gpt-4o",
  defined_terms_audit:       "openai/gpt-4o",
  cross_reference_check:     "openai/gpt-4o",

  // Claude Sonnet — primary legal reasoning workhorse
  clause_extraction:         "anthropic/claude-sonnet-4-5",
  playbook_comparison:       "anthropic/claude-sonnet-4-5",
  regulatory_citation:       "anthropic/claude-sonnet-4-5",
  fallback_generation:       "anthropic/claude-sonnet-4-5",

  // Claude Opus — deep reasoning for complex or uncertain analysis
  contradiction_detection:   "anthropic/claude-opus-4-6",
  escalation_analysis:       "anthropic/claude-opus-4-6",
  pattern_intelligence:      "anthropic/claude-opus-4-6",
  low_confidence_reanalysis: "anthropic/claude-opus-4-6",
};

/**
 * Returns the OpenRouter model string for a given analysis task.
 * Falls back to Claude Sonnet if the task is unrecognised.
 */
export function getModelForTask(task: AnalysisTask): string {
  return MODEL_MAP[task] ?? "anthropic/claude-sonnet-4-5";
}

/** Human-readable label for logs and audit trails */
export function getModelLabel(model: string): string {
  const labels: Record<string, string> = {
    "google/gemini-2.5-flash":       "Gemini 2.5 Flash",
    "openai/gpt-4o":                 "GPT-4o",
    "anthropic/claude-sonnet-4-5":   "Claude Sonnet",
    "anthropic/claude-opus-4-6":     "Claude Opus",
  };
  return labels[model] ?? model;
}
