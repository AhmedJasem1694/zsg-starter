import { useQuery } from "@tanstack/react-query";
import { FolderOpen, AlertCircle, Circle } from "lucide-react";
import { getMissingDocuments } from "../lib/api";

export default function MissingDocsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["missing-documents"],
    queryFn: getMissingDocuments,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return null;
  const missing = data?.missing ?? [];
  if (missing.length === 0) return null;

  return (
    <div className="card">
      <div className="card-body space-y-3">
        <div className="flex items-center gap-2">
          <FolderOpen size={14} className="text-primary" />
          <span className="text-sm font-semibold">Documents to review</span>
        </div>
        <p className="text-xs text-muted-foreground">
          These document types are typically important for your setup. Zane has not seen them yet.
        </p>
        <div className="space-y-3">
          {missing.map((m) => (
            <div key={m.contractType} className="flex items-start gap-2.5">
              {m.priority === "high" ? (
                <AlertCircle size={13} className="text-[#FCD34D] mt-0.5 shrink-0" />
              ) : (
                <Circle size={13} className="text-muted-foreground mt-0.5 shrink-0" />
              )}
              <div>
                <div className="text-xs font-semibold text-foreground">{m.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.reason}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
