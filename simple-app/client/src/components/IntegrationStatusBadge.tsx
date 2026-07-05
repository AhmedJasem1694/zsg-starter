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
      text: "text-[#1B7A4B]",
      defaultLabel: "Connected",
    },
    disconnected: {
      dot: "bg-[#94A3B8]",
      text: "text-[#64748B]",
      defaultLabel: "Not connected",
    },
    error: {
      dot: "bg-red-500",
      text: "text-[#A32D2D]",
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
