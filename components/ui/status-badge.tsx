import { Badge } from "@/components/ui/badge"

/**
 * Read-only status badge for shipment / container lifecycle statuses coming
 * from the oms_management backend: "On Water", "In Transit", "Cleared".
 */
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { className: string; dot: string; pulse?: boolean }> = {
    Cleared: {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    },
    "In Transit": {
      className: "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      pulse: true,
    },
    "On Water": {
      className: "border-blue-200 bg-blue-50 text-blue-700",
      dot: "bg-blue-500",
    },
  }

  const style = styles[status] ?? {
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
      {status}
    </Badge>
  )
}
