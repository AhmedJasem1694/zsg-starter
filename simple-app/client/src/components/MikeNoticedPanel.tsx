import { useQuery } from "@tanstack/react-query";
import { Lightbulb, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { getFeedbackPatterns } from "../lib/api";
import type { MikePattern } from "../lib/api";

function PatternIcon({ severity }: { severity: MikePattern["severity"] }) {
  if (severity === "good")  return <CheckCircle  size={13} className="text-[#86EFAC] shrink-0 mt-0.5" />;
  if (severity === "warn")  return <AlertTriangle size={13} className="text-[#FCD34D] shrink-0 mt-0.5" />;
  return                           <Info          size={13} className="text-[#60A5FA] shrink-0 mt-0.5" />;
}

export default function MikeNoticedPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["feedback-patterns"],
    queryFn: getFeedbackPatterns,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return null;
  const patterns = data?.patterns ?? [];
  if (patterns.length === 0) return null;

  return (
    <div className="card">
      <div className="card-body space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className="text-primary" />
          <span className="text-sm font-semibold">Patterns detected</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Zane has identified recurring risk patterns across recent reviews.
        </p>
        <div className="space-y-2.5">
          {patterns.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <PatternIcon severity={p.severity} />
              <p className="text-xs text-foreground/80 leading-relaxed">{p.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
