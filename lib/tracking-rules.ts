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

/**
 * One row extracted from a *container-keyed* forwarder report (e.g. Savino Del
 * Bene). This format has no HBL/MBL, no ETD and no revised dates — it is matched
 * directly on the container number and only carries an ETA plus an actual
 * arrival taken from the "Available Date" column.
 */
export interface ParsedContainerRecord {
  /** Container number — the match key against shipment_containers.container_number. */
  container: string
  /** Estimated arrival (the report's ETA column). */
  eta?: string | null
  /** Actual arrival, taken from the forwarder's "Available Date" column. */
  ata?: string | null
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

  // Status is derived purely from the actual events. ATA has the highest
  // priority: an arrival always means "Arrived" (CLEARED), even without an ATD.
  // No ATD and no ATA means the shipment has not departed yet -> PENDING.
  let tracking_status = "PENDING"
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

/**
 * Merge a container-keyed forwarder report row (see {@link ParsedContainerRecord})
 * into an existing container tracking row. Only ETA and ATA are touched; ETD/ATD
 * are preserved. Because this format has no "revised" concept, eta and
 * eta_original are kept in sync so no false red "revised" styling appears.
 */
export function mergeContainerRecord(
  existing: Partial<ContainerTracking>,
  rec: ParsedContainerRecord,
): ContainerTracking {
  const eta = normalizeDate(rec.eta)
  const ata = normalizeDate(rec.ata)

  const nextEta = eta ?? existing.eta ?? null
  const eta_original = eta ?? existing.eta_original ?? existing.eta ?? null
  const nextAta = ata ?? existing.ata ?? null
  const nextAtd = existing.atd ?? null

  // ATA (Available Date) has top priority -> Arrived, even without an ATD.
  let tracking_status = "PENDING"
  if (nextAtd) tracking_status = "IN_TRANSIT"
  if (nextAta) tracking_status = "CLEARED" // displayed as "Arrived"

  return {
    etd: existing.etd ?? null,
    etd_original: existing.etd_original ?? null,
    atd: nextAtd,
    eta: nextEta,
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

/* ── Split-column display helpers ──
 *
 * When ETD/ATD and ETA/ATA are shown as separate columns:
 *  - The ETD / ETA columns always show the vessel *original* planned date
 *    (plain, no tag).
 *  - The ATD / ATA columns show the actual departure/arrival (blue/green) once
 *    it exists; before that, a *revised* estimate lands here in red. This mirrors
 *    the rule "originals stay in ETD/ETA, revisions land in ATD/ATA first, then
 *    the actual replaces them".
 */

/** ETD column: the original planned departure, shown plain. */
export function etdPlannedCellState(t: Partial<ContainerTracking>): DateCellState {
  return { value: t.etd_original ?? t.etd ?? null, isActual: false, color: "default" }
}

/** ATD column: actual departure (blue) if present, else a revised ETD (red). */
export function atdCellState(t: Partial<ContainerTracking>): DateCellState {
  if (t.atd) {
    return { value: t.atd, isActual: true, color: "blue" }
  }
  const etd = t.etd ?? null
  const original = t.etd_original ?? null
  if (revisedTriggered(etd, original)) {
    return { value: etd, isActual: false, color: "red" }
  }
  return { value: null, isActual: false, color: "default" }
}

/** ETA column: the original planned arrival, shown plain. */
export function etaPlannedCellState(t: Partial<ContainerTracking>): DateCellState {
  return { value: t.eta_original ?? t.eta ?? null, isActual: false, color: "default" }
}

/** ATA column: actual arrival (green) if present, else a revised ETA (red). */
export function ataCellState(t: Partial<ContainerTracking>): DateCellState {
  if (t.ata) {
    return { value: t.ata, isActual: true, color: "green" }
  }
  const eta = t.eta ?? null
  const original = t.eta_original ?? null
  if (revisedTriggered(eta, original)) {
    return { value: eta, isActual: false, color: "red" }
  }
  return { value: null, isActual: false, color: "default" }
}
