/**
 * Shipment status machine.
 *
 * The lifecycle has three stages, derived from the actual tracking dates:
 *
 *   Pending      — not shipped yet (no ATD and no ATA)
 *   In Transit   — has departed (ATD present) but not yet arrived
 *   Arrived      — has arrived (ATA present). ATA has the highest priority:
 *                  an ATA always means "Arrived" even if the ATD is missing
 *                  (a missing ATD just means the departure document was absent).
 *
 * "On Water" and "In Transit" used to be distinct labels but mean the same
 * thing, so only "In Transit" is kept.
 *
 * Some backend rows still carry raw uppercase status tokens
 * (ON_WATER | IN_TRANSIT | CLEARED). `statusLabel` maps those to the friendly
 * labels for the parts of the app (orders / master) that read the raw token.
 */

export type RawStatus = "PENDING" | "ON_WATER" | "IN_TRANSIT" | "CLEARED" | "ARRIVED" | string

export type TrackingStatus = "Pending" | "In Transit" | "Arrived"

/**
 * The lifecycle has two halves:
 *
 *   Pending → In Transit → Arrived        (derived automatically from ATD/ATA)
 *   Arrived → Cleared → Scheduled → Closed (manual, set only in the Dispatcher)
 *
 * The manual post-arrival stages are stored in
 * `shipment_containers.dispatch_status` as the distinct tokens below. They are
 * kept separate from the legacy `tracking_status` token "CLEARED" (which,
 * confusingly, means "Arrived"), so customs-"Cleared" gets its own token.
 */
export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  // Legacy "On Water" is folded into "In Transit".
  ON_WATER: "In Transit",
  IN_TRANSIT: "In Transit",
  // The terminal tracking status is surfaced to users as "Arrived".
  CLEARED: "Arrived",
  ARRIVED: "Arrived",
  // Manual dispatch stages (post-arrival).
  CUSTOMS_CLEARED: "Cleared",
  AVAILABLE: "Available",
  SCHEDULED: "Scheduled",
  CLOSED: "Closed",
}

// Lower number = earlier in the lifecycle (least advanced).
const STATUS_ORDER: Record<string, number> = {
  PENDING: 0,
  Pending: 0,
  ON_WATER: 1,
  IN_TRANSIT: 1,
  "In Transit": 1,
  CLEARED: 2,
  ARRIVED: 2,
  Arrived: 2,
  // Manual dispatch stages continue the progression after Arrived.
  CUSTOMS_CLEARED: 3,
  Cleared: 3,
  AVAILABLE: 4,
  Available: 4,
  SCHEDULED: 5,
  Scheduled: 5,
  CLOSED: 6,
  Closed: 6,
}

/**
 * Manual dispatch stages, selectable in the Dispatcher once a container has
 * Arrived. "Arrived" is the implicit default (dispatch_status = null / no
 * override). The others map to the distinct tokens persisted in the DB.
 */
export const DISPATCH_STATUS_OPTIONS = ["Arrived", "Cleared", "Available", "Scheduled", "Closed"] as const
export type DispatchStatusOption = (typeof DISPATCH_STATUS_OPTIONS)[number]

const DISPATCH_LABEL_TO_TOKEN: Record<DispatchStatusOption, string | null> = {
  Arrived: null, // no override — falls back to the derived "Arrived"
  Cleared: "CUSTOMS_CLEARED",
  Available: "AVAILABLE",
  Scheduled: "SCHEDULED",
  Closed: "CLOSED",
}

/** Convert a dispatcher dropdown label to the token stored in dispatch_status. */
export function dispatchTokenFromLabel(label: string): string | null {
  return DISPATCH_LABEL_TO_TOKEN[label as DispatchStatusOption] ?? null
}

/**
 * Derive the display status from the actual tracking dates.
 * ATA wins over ATD (arrival is the most advanced signal).
 */
export function deriveTrackingStatus(t: {
  atd?: string | null
  ata?: string | null
}): TrackingStatus {
  if (t.ata) return "Arrived"
  if (t.atd) return "In Transit"
  return "Pending"
}

/** Convert a raw backend status token to a display label. */
export function statusLabel(raw: string | null | undefined): string {
  if (!raw) return "Pending"
  return STATUS_LABELS[raw] ?? raw
}

/**
 * Resolve the status shown to users. A manual dispatch stage (Cleared /
 * Scheduled / Closed) always wins, because it can only be set once a container
 * has Arrived. Otherwise we fall back to the status derived from ATD/ATA.
 */
export function effectiveStatus(t: {
  atd?: string | null
  ata?: string | null
  dispatch_status?: string | null
}): string {
  if (t.dispatch_status && STATUS_LABELS[t.dispatch_status]) {
    return STATUS_LABELS[t.dispatch_status]
  }
  return deriveTrackingStatus(t)
}

/**
 * Given several statuses (raw tokens or display labels), return the
 * representative display label. We surface the least-advanced status so an
 * order isn't shown as "Arrived" while part of it is still in transit.
 */
export function representativeStatus(raws: (string | null | undefined)[]): string {
  const known = raws.filter(Boolean) as string[]
  if (known.length === 0) return "Pending"
  let best = known[0]
  for (const s of known) {
    if ((STATUS_ORDER[s] ?? 99) < (STATUS_ORDER[best] ?? 99)) {
      best = s
    }
  }
  return statusLabel(best)
}

/** All display labels, useful for filter option lists. */
export const STATUS_DISPLAY_VALUES = [
  "Pending",
  "In Transit",
  "Arrived",
  "Cleared",
  "Available",
  "Scheduled",
  "Closed",
] as const

/** Lifecycle steps used by the detail timeline UI (display labels). */
export const STATUS_STEPS = [
  { label: "Pending", step: 0 },
  { label: "In Transit", step: 1 },
  { label: "Arrived", step: 2 },
  { label: "Cleared", step: 3 },
  { label: "Available", step: 4 },
  { label: "Scheduled", step: 5 },
  { label: "Closed", step: 6 },
]

/** Map a display label (or raw token) to its timeline step index. */
export function getStatusStep(status: string): number {
  const stepByLabel: Record<string, number> = {
    Pending: 0,
    "In Transit": 1,
    Arrived: 2,
    Cleared: 3,
    Available: 4,
    Scheduled: 5,
    Closed: 6,
  }
  // Accept both display labels and raw tokens.
  return stepByLabel[status] ?? stepByLabel[statusLabel(status)] ?? 0
}
