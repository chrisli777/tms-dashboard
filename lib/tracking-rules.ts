/**
 * Shipment tracking business rules.
 *
 * A tracking document (Excel/CSV arrival / departure notice) is parsed into a
 * list of {@link ParsedTrackingRecord}. Each record is keyed by HBL, which maps
 * to a shipment BOL number. We then merge the parsed dates into the existing
 * per-container tracking columns following these rules:
 *
 *  ETD column ("ETD / ATD")
 *   - vessel original ETD  -> etd (and etd_original)
 *   - revised ETD          -> etd (etd_original keeps the original)  => RED
 *   - ATD present          -> shown in the ETD/ATD slot              => BLUE,
 *                             status advances to In Transit
 *
 *  ETA column ("ETA / ATA")
 *   - vessel original ETA  -> eta (and eta_original)
 *   - revised ETA          -> eta (eta_original keeps the original)  => RED
 *   - ATA present          -> shown in the ETA/ATA slot              => GREEN,
 *                             status advances to Arrived
 *
 * The raw backend status token for the terminal "Arrived" state remains
 * CLEARED (see lib/status.ts), so downstream queries keep working.
 */

/** One row extracted from an uploaded tracking document by Claude. */
export interface ParsedTrackingRecord {
  /** House B/L — primary match key against shipments.bol_number. */
  hbl: string
  /** Master B/L — fallback match key (many backends store the MBL as bol_number). */
  mbl?: string | null
  vesselOriginalEtd?: string | null
  revisedEtd?: string | null
  atd?: string | null
  vesselOriginalEta?: string | null
  revisedEta?: string | null
  ata?: string | null
  /** Optional free-form vessel/voyage label, surfaced in the preview only. */
  vessel?: string | null
}

/** The persisted per-container tracking columns. */
export interface ContainerTracking {
  etd: string | null
  etd_original: string | null
  atd: string | null
  eta: string | null
  eta_original: string | null
  ata: string | null
  tracking_status: string | null
}

/** Normalize a value to YYYY-MM-DD or null. */
export function normalizeDate(value: unknown): string | null {
  if (value == null || value === "") return null
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const str = String(value).trim()
  if (!str) return null
  const d = new Date(str)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/**
 * Merge a parsed tracking record into an existing container tracking row,
 * applying the precedence rules above. Never nulls out existing data when the
 * document omits a field.
 */
export function mergeContainerTracking(
  existing: Partial<ContainerTracking>,
  rec: ParsedTrackingRecord,
): ContainerTracking {
  const origEtd = normalizeDate(rec.vesselOriginalEtd)
  const revEtd = normalizeDate(rec.revisedEtd)
  const atd = normalizeDate(rec.atd)
  const origEta = normalizeDate(rec.vesselOriginalEta)
  const revEta = normalizeDate(rec.revisedEta)
  const ata = normalizeDate(rec.ata)

  const etd_original =
    origEtd ?? existing.etd_original ?? existing.etd ?? null
  const etd = revEtd ?? origEtd ?? existing.etd ?? null

  const eta_original =
    origEta ?? existing.eta_original ?? existing.eta ?? null
  const eta = revEta ?? origEta ?? existing.eta ?? null

  const nextAtd = atd ?? existing.atd ?? null
  const nextAta = ata ?? existing.ata ?? null

  // Status advances with the latest actual event.
  let tracking_status = existing.tracking_status ?? "ON_WATER"
  if (nextAtd) tracking_status = "IN_TRANSIT"
  if (nextAta) tracking_status = "CLEARED" // displayed as "Arrived"

  return {
    etd,
    etd_original,
    atd: nextAtd,
    eta,
    eta_original,
    ata: nextAta,
    tracking_status,
  }
}

/* ── Display helpers used by the shipment tables ── */

export type DateCellColor = "default" | "red" | "blue" | "green"

export interface DateCellState {
  /** The date to render (YYYY-MM-DD) or null. */
  value: string | null
  /** Whether the rendered value is an actual (ATD/ATA) rather than estimate. */
  isActual: boolean
  color: DateCellColor
}

/** Tailwind text classes for each cell color. */
export const DATE_CELL_CLASS: Record<DateCellColor, string> = {
  default: "text-foreground",
  red: "text-destructive font-semibold",
  blue: "text-blue-600 font-semibold",
  green: "text-emerald-600 font-semibold",
}

function revisedTriggered(current: string | null, original: string | null) {
  return !!(current && original && current !== original)
}

/** Resolve the "ETD / ATD" cell for a container's tracking data. */
export function etdCellState(t: Partial<ContainerTracking>): DateCellState {
  if (t.atd) {
    return { value: t.atd, isActual: true, color: "blue" }
  }
  const etd = t.etd ?? null
  const original = t.etd_original ?? null
  return {
    value: etd,
    isActual: false,
    color: revisedTriggered(etd, original) ? "red" : "default",
  }
}

/** Resolve the "ETA / ATA" cell for a container's tracking data. */
export function etaCellState(t: Partial<ContainerTracking>): DateCellState {
  if (t.ata) {
    return { value: t.ata, isActual: true, color: "green" }
  }
  const eta = t.eta ?? null
  const original = t.eta_original ?? null
  return {
    value: eta,
    isActual: false,
    color: revisedTriggered(eta, original) ? "red" : "default",
  }
}
