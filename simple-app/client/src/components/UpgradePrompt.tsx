import { Lock, ArrowRight } from "lucide-react";
import type { SubscriptionTier } from "../contexts/FeatureFlagsContext";

const TIER_LABELS: Record<SubscriptionTier, string> = {
  trial:   "Trial",
  starter: "Starter",
  team:    "Team",
  growth:  "Growth",
};

interface UpgradePromptProps {
  feature: string;
  requiredTier: SubscriptionTier;
  /** When true, renders as an overlay on top of blurred children */
  overlay?: boolean;
  children?: React.ReactNode;
}

/**
 * Locked-preview upgrade prompt.
 *
 * Two modes:
 *   overlay={false}, standalone banner (for whole-page locks)
 *   overlay={true} , overlays blurred children (shows what the feature looks like)
 */
export default function UpgradePrompt({
  feature,
  requiredTier,
  overlay = false,
  children,
}: UpgradePromptProps) {
  const tierLabel = TIER_LABELS[requiredTier];

  const prompt = (
    <div className={`flex flex-col items-center gap-4 text-center ${overlay ? "p-8" : "p-6"}`}>
      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Lock size={16} className="text-primary" />
      </div>
      <div className="space-y-1.5">
        <div className="text-sm font-semibold text-foreground">{feature}</div>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
          Available on the <span className="font-semibold text-primary">{tierLabel} plan</span> and above.
          Upgrade to unlock this feature.
        </p>
      </div>
      <a
        href="/#pricing"
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity shadow shadow-primary/20"
      >
        Upgrade to {tierLabel} <ArrowRight size={12} />
      </a>
    </div>
  );

  if (!overlay) {
    return (
      <div className="card border border-primary/15 bg-primary/3">
        {prompt}
      </div>
    );
  }

  // Overlay mode: blur the children and show the prompt on top
  return (
    <div className="relative">
      {/* Blurred preview of the locked content */}
      <div className="pointer-events-none select-none" style={{ filter: "blur(4px)", opacity: 0.4 }}>
        {children}
      </div>
      {/* Upgrade prompt centred over the blur */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="card border border-primary/20 bg-card/95 shadow-2xl max-w-sm w-full mx-4 backdrop-blur-sm">
          {prompt}
        </div>
      </div>
    </div>
  );
}
