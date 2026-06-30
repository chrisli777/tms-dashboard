/**
 * Status normalization for the oms_management backend.
 *
 * The order_management_view exposes shipment status as uppercase tokens:
 *   ON_WATER | IN_TRANSIT | CLEARED
 *
 * The frontend renders human-friendly labels. This helper maps between the two
 * and provides an ordering used to pick a single representative status when a
 * PO / order spans multiple shipments.
 */

export type RawStatus = "ON_WATER" | "IN_TRANSIT" | "CLEARED" | "ARRIVED" | string

export const STATUS_LABELS: Record<string, string> = {
  ON_WATER: "On Water",
  IN_TRANSIT: "In Transit",
  // The terminal status is surfaced to users as "Arrived" (replacing the
  // legacy "Cleared" label). The raw DB token remains CLEARED for existing
  // data; ARRIVED is accepted for forward compatibility.
  CLEARED: "Arrived",
  ARRIVED: "Arrived",
}

// Lower number = earlier in the lifecycle (least advanced).
const STATUS_ORDER: Record<string, number> = {
  ON_WATER: 0,
  IN_TRANSIT: 1,
  CLEARED: 2,
  ARRIVED: 2,
}

/** Convert a raw backend status token to a display label. */
export function statusLabel(raw: string | null | undefined): string {
  if (!raw) return "Unknown"
  return STATUS_LABELS[raw] ?? raw
}

/**
 * Given several raw statuses (e.g. one per shipment line in a PO), return the
 * representative display label. We surface the least-advanced status so an
 * order isn't shown as "Arrived" while part of it is still on the water.
 */
export function representativeStatus(raws: (string | null | undefined)[]): string {
  const known = raws.filter(Boolean) as string[]
  if (known.length === 0) return "Unknown"
  let best = known[0]
  for (const s of known) {
    if ((STATUS_ORDER[s] ?? 99) < (STATUS_ORDER[best] ?? 99)) {
      best = s
    }
  }
  return statusLabel(best)
}

/** All display labels, useful for filter option lists. */
export const STATUS_DISPLAY_VALUES = ["On Water", "In Transit", "Arrived"] as const

/** Lifecycle steps used by the detail timeline UI (display labels). */
export const STATUS_STEPS = [
  { label: "On Water", step: 0 },
  { label: "In Transit", step: 1 },
  { label: "Arrived", step: 2 },
]

/** Map a display label (or raw token) to its timeline step index. */
export function getStatusStep(status: string): number {
  const stepByLabel: Record<string, number> = {
    "On Water": 0,
    "In Transit": 1,
    "Arrived": 2,
  }
  // Accept both display labels and raw tokens.
  return stepByLabel[status] ?? stepByLabel[statusLabel(status)] ?? 0
}
