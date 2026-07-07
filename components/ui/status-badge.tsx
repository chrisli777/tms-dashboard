import { Badge } from "@/components/ui/badge"
import { statusLabel } from "@/lib/status"

/**
 * Read-only status badge for shipment / container lifecycle statuses coming
 * from the oms_management backend. Accepts either raw tokens (e.g. "ON_WATER")
 * or display labels (e.g. "On Water") and always renders the friendly label.
 */
export function StatusBadge({ status }: { status: string }) {
  const label = statusLabel(status)
  const styles: Record<string, { className: string; dot: string; pulse?: boolean }> = {
    Arrived: {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    },
    "In Transit": {
      className: "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      pulse: true,
    },
    Pending: {
      className: "border-slate-200 bg-slate-50 text-slate-600",
      dot: "bg-slate-400",
    },
    // Manual post-arrival dispatch stages.
    Cleared: {
      className: "border-blue-200 bg-blue-50 text-blue-700",
      dot: "bg-blue-500",
    },
    Available: {
      className: "border-cyan-200 bg-cyan-50 text-cyan-700",
      dot: "bg-cyan-500",
    },
    Scheduled: {
      className: "border-teal-200 bg-teal-50 text-teal-700",
      dot: "bg-teal-500",
    },
    Closed: {
      className: "border-slate-300 bg-slate-100 text-slate-700",
      dot: "bg-slate-500",
    },
  }

  const style = styles[label] ?? {
    className: "border-slate-200 bg-slate-50 text-slate-700",
    dot: "bg-slate-400",
  }

  return (
    <Badge variant="outline" className={style.className}>
      <span
        className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${style.dot} ${
          style.pulse ? "animate-pulse" : ""
        }`}
      />
      {label}
    </Badge>
  )
}
