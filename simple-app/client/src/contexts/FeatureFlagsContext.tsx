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

// ── Defaults (most restrictive — used while loading) ──────────────────────────

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

const FeatureFlagsContext = createContext<FeatureFlagsState>({
  tier: "starter",
  flags: DEFAULT_FLAGS,
  trialDaysRemaining: null,
  reviewsThisMonth: 0,
  isLoading: true,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: fetchFeatureFlags,
    staleTime: 5 * 60_000, // 5 minutes — tier rarely changes mid-session
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
