interface IntegrationStatusBadgeProps {
  status: "connected" | "disconnected" | "error";
  label?: string;
}

export default function IntegrationStatusBadge({
  status,
  label,
}: IntegrationStatusBadgeProps) {
  const configs = {
    connected: {
      dot: "bg-emerald-500",
      text: "text-emerald-400",
      defaultLabel: "Connected",
    },
    disconnected: {
      dot: "bg-slate-500",
      text: "text-slate-400",
      defaultLabel: "Not connected",
    },
    error: {
      dot: "bg-red-500",
      text: "text-red-400",
      defaultLabel: "Error",
    },
  };

  const { dot, text, defaultLabel } = configs[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label ?? defaultLabel}
    </span>
  );
}
