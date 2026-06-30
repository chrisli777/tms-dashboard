import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import Anthropic from "@anthropic-ai/sdk"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  mergeContainerTracking,
  etdCellState,
  etaCellState,
  type ParsedTrackingRecord,
  type ContainerTracking,
} from "@/lib/tracking-rules"

export const runtime = "nodejs"
export const maxDuration = 60

const MODEL = "claude-haiku-4-5-20251001"

/** Canonical tracking fields we extract from the spreadsheet. */
const FIELDS = [
  "hbl",
  "mbl",
  "vesselOriginalEtd",
  "revisedEtd",
  "atd",
  "vesselOriginalEta",
  "revisedEta",
  "ata",
  "vessel",
] as const
type Field = (typeof FIELDS)[number]
type ColumnMap = Record<Field, string | null>

interface ParsedSheet {
  headers: string[]
  rows: unknown[][]
}

/**
 * Read the workbook and locate the header row (the first row that looks like
 * column titles — i.e. contains an HBL / B/L style header). Returns the header
 * labels plus the data rows beneath them.
 */
function parseWorkbook(buffer: ArrayBuffer): ParsedSheet {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true })
  // Prefer the sheet with the most rows (the report sheet).
  let best: ParsedSheet = { headers: [], rows: [] }
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      blankrows: false,
      defval: null,
    })
    if (grid.length < 2) continue

    const headerIdx = findHeaderRow(grid)
    const headers = (grid[headerIdx] ?? []).map((c) =>
      c == null ? "" : String(c).trim(),
    )
    const rows = grid.slice(headerIdx + 1)
    if (rows.length > best.rows.length) best = { headers, rows }
  }
  return best
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** Find the header row: the row (within the first 15) most likely to be titles. */
function findHeaderRow(grid: unknown[][]): number {
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const cells = (grid[i] ?? []).map((c) => norm(c == null ? "" : String(c)))
    const hasHbl = cells.some(
      (c) => c === "hbl" || c.includes("houseb") || c === "hbol",
    )
    const hasDateCol = cells.some((c) => c.includes("etd") || c.includes("eta"))
    if (hasHbl && hasDateCol) return i
  }
  return 0
}

/* ── Deterministic synonym matching (fallback / merge with Claude) ── */

function matchField(field: Field, header: string): boolean {
  const h = norm(header)
  if (!h) return false
  switch (field) {
    case "hbl":
      return h === "hbl" || h === "hbol" || h.includes("houseb")
    case "mbl":
      return h === "mbl" || h === "mbol" || h.includes("masterb")
    case "atd":
      return h.includes("atd") || (h.includes("actual") && h.includes("depart"))
    case "ata":
      return h.includes("ata") || (h.includes("actual") && h.includes("arriv"))
    case "revisedEtd":
      return h.includes("revis") && h.includes("etd")
    case "revisedEta":
      return h.includes("revis") && h.includes("eta")
    case "vesselOriginalEtd":
      return h.includes("etd") && !h.includes("revis") && !h.includes("atd")
    case "vesselOriginalEta":
      return h.includes("eta") && !h.includes("revis") && !h.includes("ata")
    case "vessel":
      return (
        h.includes("mothervessel") || h.includes("feedervessel") || h === "vessel"
      )
    default:
      return false
  }
}

function synonymMap(headers: string[]): ColumnMap {
  const map = Object.fromEntries(FIELDS.map((f) => [f, null])) as ColumnMap
  for (const field of FIELDS) {
    const hit = headers.find((hd) => matchField(field, hd))
    if (hit) map[field] = hit
  }
  return map
}

/**
 * Use Claude to map this file's column headers onto our canonical fields. The
 * payload is just the header list, so the response is tiny and reliable (no
 * truncation regardless of how many data rows the file has). Falls back to
 * deterministic synonym matching for anything Claude leaves unmapped.
 */
async function resolveColumnMap(headers: string[]): Promise<ColumnMap> {
  const fallback = synonymMap(headers)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return fallback

  try {
    const anthropic = new Anthropic({ apiKey })
    const prompt = `You map spreadsheet column headers to canonical shipment-tracking fields.

Here are the column headers from an ocean freight in-transit / arrival report (as a JSON array, in order):
${JSON.stringify(headers)}

Map these canonical fields to the EXACT header string that best matches (or null if absent):
- hbl: House Bill of Lading number (the forwarder's house B/L)
- mbl: Master Bill of Lading number (the carrier's ocean B/L, e.g. SCAC-prefixed)
- vesselOriginalEtd: the original / estimated departure date column
- revisedEtd: a revised / updated estimated departure date column
- atd: ACTUAL departure date column (ATD)
- vesselOriginalEta: the original / estimated arrival date column
- revisedEta: a revised / updated estimated arrival date column
- ata: ACTUAL arrival date column (ATA)
- vessel: the vessel / voyage name column (prefer the mother vessel)

Respond with ONLY a JSON object mapping each field to a header string from the array above or null. No prose, no markdown.
Example: {"hbl":"HBL","mbl":"MBL","vesselOriginalEtd":"Vessel Original ETD","revisedEtd":"Vessel Revised ETD","atd":"Vessel ATD","vesselOriginalEta":"Original ETA","revisedEta":"Revised ETA","ata":"ATA","vessel":"Mother Vessel"}`

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    if (start === -1 || end === -1) return fallback

    const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    const headerSet = new Set(headers)
    const map = { ...fallback }
    for (const field of FIELDS) {
      const v = raw[field]
      // Only trust Claude's value if it's an actual header in the file.
      if (typeof v === "string" && headerSet.has(v)) map[field] = v
    }
    return map
  } catch (err) {
    console.error("[v0] column-map fallback:", err instanceof Error ? err.message : err)
    return fallback
  }
}

/** Build tracking records deterministically from the rows using the column map. */
function extractRecords(sheet: ParsedSheet, map: ColumnMap): ParsedTrackingRecord[] {
  const idx = Object.fromEntries(
    FIELDS.map((f) => [f, map[f] ? sheet.headers.indexOf(map[f] as string) : -1]),
  ) as Record<Field, number>

  if (idx.hbl < 0) return []

  const cell = (row: unknown[], i: number) => (i >= 0 ? row[i] ?? null : null)
  const str = (v: unknown) => (v == null ? null : String(v).trim() || null)

  const records: ParsedTrackingRecord[] = []
  for (const row of sheet.rows) {
    const hbl = str(cell(row, idx.hbl))
    if (!hbl) continue
    records.push({
      hbl,
      mbl: str(cell(row, idx.mbl)),
      vesselOriginalEtd: cell(row, idx.vesselOriginalEtd) as string | null,
      revisedEtd: cell(row, idx.revisedEtd) as string | null,
      atd: cell(row, idx.atd) as string | null,
      vesselOriginalEta: cell(row, idx.vesselOriginalEta) as string | null,
      revisedEta: cell(row, idx.revisedEta) as string | null,
      ata: cell(row, idx.ata) as string | null,
      vessel: str(cell(row, idx.vessel)),
    })
  }
  return records
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const sheet = parseWorkbook(await file.arrayBuffer())
    if (sheet.headers.length === 0 || sheet.rows.length === 0) {
      return NextResponse.json({ error: "The file appears to be empty" }, { status: 400 })
    }

    const map = await resolveColumnMap(sheet.headers)
    if (!map.hbl) {
      return NextResponse.json(
        { error: "Could not find an HBL / House B/L column in the file" },
        { status: 422 },
      )
    }

    const records = extractRecords(sheet, map)
    if (records.length === 0) {
      return NextResponse.json(
        { error: "No HBL rows could be extracted from the file" },
        { status: 422 },
      )
    }

    const supabase = createAdminClient()

    const preview = await Promise.all(
      records.map(async (rec) => {
        const hbl = rec.hbl.trim()
        const mbl = rec.mbl?.trim() || null

        // Match strictly on the House B/L against shipments.bol_number.
        const { data: shipments } = await supabase
          .from("shipments")
          .select("id, bol_number")
          .eq("bol_number", hbl)

        const shipmentIds = (shipments ?? []).map((s) => s.id as string)

        let containers: (ContainerTracking & { id: string })[] = []
        if (shipmentIds.length > 0) {
          const { data: ctrs } = await supabase
            .from("shipment_containers")
            .select("id, etd, etd_original, atd, eta, eta_original, ata, tracking_status")
            .in("shipment_id", shipmentIds)
          containers = (ctrs ?? []) as (ContainerTracking & { id: string })[]
        }

        const sample = containers[0] ?? {}
        const merged = mergeContainerTracking(sample, rec)

        return {
          hbl,
          mbl,
          vessel: rec.vessel ?? null,
          matched: shipmentIds.length > 0,
          containerCount: containers.length,
          parsed: rec,
          before: {
            etd: etdCellState(sample),
            eta: etaCellState(sample),
            status: sample.tracking_status ?? null,
          },
          after: {
            etd: etdCellState(merged),
            eta: etaCellState(merged),
            status: merged.tracking_status,
          },
        }
      }),
    )

    return NextResponse.json({
      fileName: file.name,
      recordCount: records.length,
      matchedCount: preview.filter((p) => p.matched).length,
      preview,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse file"
    console.error("[v0] upload parse error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
