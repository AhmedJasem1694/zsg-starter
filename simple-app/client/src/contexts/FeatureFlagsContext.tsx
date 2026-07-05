import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFeatureFlags as fetchFeatureFlags } from "../lib/api";

// ── Types (mirrored from server/services/featureFlags.ts) ─────────────────────

export type SubscriptionTier = "trial" | "starter" | "team" | "growth";

export interface FeatureFlags {
  maxUsers: number;
  maxMonthlyReviews: number;
  maxPlaybookClauses: number;
  portfolioDashboard: boolean;
  legalInheritance: boolean;
  newHireBriefing: boolean;
  patternIntelligence: boolean;
  contradictionDetection: boolean;
  counterpartyIntelligence: boolean;
  playbookDrift: boolean;
  playbookHealthScore: boolean;
  boardReporting: boolean;
  advancedRegulatory: boolean;
  apiAccess: boolean;
  multiEntity: boolean;
  prioritySupport: boolean;
  customSectorConfig: boolean;
}

export interface FeatureFlagsState {
  tier: SubscriptionTier;
  flags: FeatureFlags;
  trialDaysRemaining: number | null;
  reviewsThisMonth: number;
  isLoading: boolean;
}

// ── Defaults (most restrictive, used while loading) ──────────────────────────

const DEFAULT_FLAGS: FeatureFlags = {
  maxUsers: 1,
  maxMonthlyReviews: 20,
  maxPlaybookClauses: 10,
  portfolioDashboard: false,
  legalInheritance: false,
  newHireBriefing: false,
  patternIntelligence: false,
  contradictionDetection: false,
  counterpartyIntelligence: false,
  playbookDrift: false,
  playbookHealthScore: false,
  boardReporting: false,
  advancedRegulatory: false,
  apiAccess: false,
  multiEntity: false,
  prioritySupport: false,
  customSectorConfig: false,
};

// ── Context ───────────────────────────────────────────────────────────────────
// The context object is stored on globalThis so that if Vite's dev server ever
// evaluates this module twice (HMR can register the file under two different
// query-string URLs), both instances share the same context. Without this, the
// provider writes to one context while consumers read the other's default value,
// and every flag-gated page shows its upgrade wall in dev despite the API
// returning the correct tier. Production bundles evaluate the module once, so
// this is a no-op there.

const CONTEXT_KEY = "__zaneFeatureFlagsContext";
const globalStore = globalThis as unknown as Record<string, React.Context<FeatureFlagsState> | undefined>;

const FeatureFlagsContext: React.Context<FeatureFlagsState> =
  globalStore[CONTEXT_KEY] ??
  createContext<FeatureFlagsState>({
    tier: "starter",
    flags: DEFAULT_FLAGS,
    trialDaysRemaining: null,
    reviewsThisMonth: 0,
    isLoading: true,
  });
globalStore[CONTEXT_KEY] = FeatureFlagsContext;

// ── Provider ──────────────────────────────────────────────────────────────────

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: fetchFeatureFlags,
    staleTime: 5 * 60_000, // 5 minutes, tier rarely changes mid-session
    retry: false,
  });

  const value: FeatureFlagsState = {
    tier: (data?.tier ?? "starter") as SubscriptionTier,
    flags: (data?.flags ?? DEFAULT_FLAGS) as FeatureFlags,
    trialDaysRemaining: data?.trialDaysRemaining ?? null,
    reviewsThisMonth: data?.reviewsThisMonth ?? 0,
    isLoading,
  };

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFeatureFlags(): FeatureFlagsState {
  return useContext(FeatureFlagsContext);
}
