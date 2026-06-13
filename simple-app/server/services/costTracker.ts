/**
 * Per-pipeline-run LLM cost tracking.
 *
 * Uses AsyncLocalStorage so the OpenRouter client can report token usage from
 * anywhere inside a review run without threading a tracker object through
 * every call signature. reviewOrchestrator wraps each run in
 * withCostTracking(); openrouter.chatComplete() calls recordLlmUsage() with
 * the usage block from each OpenRouter response.
 *
 * Costs are estimates: tokens in/out per call × model list rate (modelRouter).
 * Runs outside a tracking context (e.g. onboarding company search) are
 * silently ignored. recordLlmUsage is a no-op without an active context.
 */

import { AsyncLocalStorage } from "async_hooks";
import { getModelRates } from "./modelRouter.js";

export interface LlmCallUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export interface CostSummary {
  totalCostUsd: number;
  promptTokens: number;
  completionTokens: number;
  llmCalls: number;
  byModel: Record<string, { calls: number; promptTokens: number; completionTokens: number; costUsd: number }>;
}

interface CostContext {
  calls: LlmCallUsage[];
}

const storage = new AsyncLocalStorage<CostContext>();

/** Report one LLM call's token usage. No-op outside a tracking context. */
export function recordLlmUsage(model: string, promptTokens: number, completionTokens: number): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  const rates = getModelRates(model);
  const costUsd =
    (promptTokens / 1_000_000) * rates.inputPerMTok +
    (completionTokens / 1_000_000) * rates.outputPerMTok;
  ctx.calls.push({ model, promptTokens, completionTokens, costUsd });
}

function summarise(ctx: CostContext): CostSummary {
  const byModel: CostSummary["byModel"] = {};
  let totalCostUsd = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  for (const call of ctx.calls) {
    totalCostUsd += call.costUsd;
    promptTokens += call.promptTokens;
    completionTokens += call.completionTokens;
    const m = (byModel[call.model] ??= { calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 });
    m.calls += 1;
    m.promptTokens += call.promptTokens;
    m.completionTokens += call.completionTokens;
    m.costUsd += call.costUsd;
  }
  return {
    totalCostUsd: Math.round(totalCostUsd * 10_000) / 10_000,
    promptTokens,
    completionTokens,
    llmCalls: ctx.calls.length,
    byModel,
  };
}

/**
 * Run fn inside a fresh cost-tracking context. onSettled receives the summary
 * whether fn resolves or rejects (so partial costs of failed runs are still
 * logged). onSettled errors are swallowed. Cost logging never breaks a run.
 */
export async function withCostTracking<T>(
  fn: () => Promise<T>,
  onSettled?: (summary: CostSummary) => void
): Promise<T> {
  const ctx: CostContext = { calls: [] };
  try {
    return await storage.run(ctx, fn);
  } finally {
    if (onSettled) {
      try {
        onSettled(summarise(ctx));
      } catch (err) {
        console.warn("[costTracker] onSettled failed (non-fatal):", (err as Error)?.message);
      }
    }
  }
}
