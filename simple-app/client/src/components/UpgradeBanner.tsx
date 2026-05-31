import { Link } from "react-router-dom";
import { Lock, ArrowRight, CheckCircle } from "lucide-react";

interface UpgradeBannerProps {
  feature: string;
  description: string;
  bullets?: string[];
  tier?: "starter" | "professional" | "enterprise";
}

const TIER_CONFIG = {
  starter:      { label: "Zane Starter",      price: "£300/month", color: "text-primary",        bg: "bg-primary/8 border-primary/20" },
  professional: { label: "Zane Professional", price: "£750/month", color: "text-violet-400",     bg: "bg-violet-400/8 border-violet-400/20" },
  enterprise:   { label: "Zane Enterprise",   price: "Custom",     color: "text-white",          bg: "bg-[#1C0F00] border-[#431407]" },
};

export default function UpgradeBanner({
  feature,
  description,
  bullets = [],
  tier = "starter",
}: UpgradeBannerProps) {
  const config = TIER_CONFIG[tier];

  return (
    <div className={`rounded-xl border p-6 space-y-4 ${config.bg}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center shrink-0 mt-0.5">
          <Lock size={14} className={config.color} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{feature}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${config.bg} ${config.color}`}>
              {config.label} · {config.price}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>

      {bullets.length > 0 && (
        <ul className="space-y-1.5 pl-11">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle size={10} className={config.color} />
              {b}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3 pl-11">
        <Link
          to="/register"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
        >
          Start 14-day free trial <ArrowRight size={11} />
        </Link>
        <a href="/#pricing" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          See all plans
        </a>
      </div>
    </div>
  );
}
