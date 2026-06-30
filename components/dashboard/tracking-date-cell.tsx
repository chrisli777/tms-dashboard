import { DATE_CELL_CLASS, type DateCellState } from "@/lib/tracking-rules"

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—"
  const date = new Date(dateStr + "T00:00:00")
  if (isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Renders an ETD/ATD or ETA/ATA value with the color + tag dictated by the
 * tracking business rules:
 *  - blue  -> actual departure (ATD)
 *  - green -> actual arrival (ATA)
 *  - red   -> a revised estimate replaced the original
 */
export function TrackingDateCell({
  state,
  kind,
  inline = false,
}: {
  state: DateCellState
  kind: "etd" | "eta"
  inline?: boolean
}) {
  const tag = state.isActual
    ? kind === "etd"
      ? "ATD"
      : "ATA"
    : state.color === "red"
      ? "Revised"
      : null

  return (
    <span className={`inline-flex items-center gap-1.5 ${inline ? "text-xs" : "text-sm"}`}>
      <span className={`tabular-nums ${DATE_CELL_CLASS[state.color]}`}>
        {formatDate(state.value)}
      </span>
      {tag && (
        <span
          className={`rounded px-1 py-0.5 text-[10px] font-semibold leading-none ${
            state.color === "blue"
              ? "bg-blue-100 text-blue-700"
              : state.color === "green"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-destructive/10 text-destructive"
          }`}
        >
          {tag}
        </span>
      )}
    </span>
  )
}
