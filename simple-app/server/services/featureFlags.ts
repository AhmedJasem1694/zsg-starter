/**
 * Feature flags service.
 * Maps subscription tiers to specific feature availability.
 * -1 means unlimited (no cap enforced).
 */

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

const FLAGS: Record<SubscriptionTier, FeatureFlags> = {
  trial: {
    maxUsers: 3,
    maxMonthlyReviews: 5,
    maxPlaybookClauses: 10,
    portfolioDashboard: true,
    legalInheritance: true,
    newHireBriefing: true,
    patternIntelligence: true,
    contradictionDetection: true,
    counterpartyIntelligence: true,
    playbookDrift: true,
    playbookHealthScore: true,
    boardReporting: true,
    advancedRegulatory: true,
    apiAccess: false,
    multiEntity: false,
    prioritySupport: false,
    customSectorConfig: false,
  },
  starter: {
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
  },
  team: {
    maxUsers: 5,
    maxMonthlyReviews: -1,
    maxPlaybookClauses: -1,
    portfolioDashboard: true,
    legalInheritance: true,
    newHireBriefing: true,
    patternIntelligence: true,
    contradictionDetection: true,
    counterpartyIntelligence: true,
    playbookDrift: true,
    playbookHealthScore: true,
    boardReporting: false,
    advancedRegulatory: false,
    apiAccess: false,
    multiEntity: false,
    prioritySupport: false,
    customSectorConfig: false,
  },
  growth: {
    maxUsers: -1,
    maxMonthlyReviews: -1,
    maxPlaybookClauses: -1,
    portfolioDashboard: true,
    legalInheritance: true,
    newHireBriefing: true,
    patternIntelligence: true,
    contradictionDetection: true,
    counterpartyIntelligence: true,
    playbookDrift: true,
    playbookHealthScore: true,
    boardReporting: true,
    advancedRegulatory: true,
    apiAccess: true,
    multiEntity: true,
    prioritySupport: true,
    customSectorConfig: true,
  },
};

export function getFeatureFlags(tier: SubscriptionTier): FeatureFlags {
  return FLAGS[tier] ?? FLAGS.starter;
}

/** Resolve tier from raw DB value, defaulting to trial for unknowns */
export function resolveTier(raw: unknown): SubscriptionTier {
  if (raw === "starter" || raw === "team" || raw === "growth" || raw === "trial") {
    return raw;
  }
  return "trial";
}

/** Days since a date string */
export function daysSince(dateStr: string): number {
  const created = new Date(dateStr);
  if (isNaN(created.getTime())) return 0;
  const diffMs = Date.now() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** For trial accounts: how many days remain in the 14-day trial */
export function trialDaysRemaining(companyCreatedAt: string): number {
  const used = daysSince(companyCreatedAt);
  return Math.max(0, 14 - used);
}
