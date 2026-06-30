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

const MODEL = "claude-3-5-sonnet-20241022"

/** Turn an uploaded spreadsheet into a compact CSV string for the model. */
function fileToCsv(buffer: ArrayBuffer): string {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true })
  const chunks: string[] = []
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    if (csv.trim()) chunks.push(`# Sheet: ${name}\n${csv}`)
  }
  return chunks.join("\n\n")
}

async function extractRecords(csv: string): Promise<ParsedTrackingRecord[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set")

  const anthropic = new Anthropic({ apiKey })

  const prompt = `You are a logistics data extraction assistant. Below is the raw content of a shipment tracking spreadsheet (departure / arrival notice). Extract one record per House Bill of Lading (HBL / HB/L / House B/L).

For each HBL, extract these fields (use null when not present):
- hbl: the House B/L number (string)
- vesselOriginalEtd: the originally scheduled / estimated departure date
- revisedEtd: a revised / updated estimated departure date, if the document shows the ETD changed
- atd: the ACTUAL departure date (ATD), if departure already happened
- vesselOriginalEta: the originally scheduled / estimated arrival date
- revisedEta: a revised / updated estimated arrival date, if the document shows the ETA changed
- ata: the ACTUAL arrival date (ATA), if arrival already happened
- vessel: vessel / voyage name if present

Rules:
- Output ALL dates as ISO strings "YYYY-MM-DD". If you cannot determine a full date, use null.
- Distinguish ESTIMATED vs ACTUAL by the column headers (ETD/ETA = estimated, ATD/ATA = actual). If a column is just labelled "ETD"/"ETA" and there is no separate revised column, treat it as vesselOriginalEtd / vesselOriginalEta.
- Only include rows that have an HBL value.

Respond with ONLY a JSON array, no prose, no markdown fences. Example:
[{"hbl":"ABC123","vesselOriginalEtd":"2025-01-10","revisedEtd":null,"atd":null,"vesselOriginalEta":"2025-02-05","revisedEta":null,"ata":null,"vessel":"EVER GIVEN 001E"}]

Spreadsheet content:
${csv.slice(0, 60000)}`

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  })

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()

  // Strip accidental code fences and isolate the JSON array.
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  const start = cleaned.indexOf("[")
  const end = cleaned.lastIndexOf("]")
  if (start === -1 || end === -1) {
    throw new Error("Model did not return a JSON array")
  }
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as ParsedTrackingRecord[]
  return parsed.filter((r) => r && typeof r.hbl === "string" && r.hbl.trim())
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const csv = fileToCsv(await file.arrayBuffer())
    if (!csv.trim()) {
      return NextResponse.json({ error: "The file appears to be empty" }, { status: 400 })
    }

    const records = await extractRecords(csv)
    if (records.length === 0) {
      return NextResponse.json(
        { error: "No HBL rows could be extracted from the file" },
        { status: 422 },
      )
    }

    const supabase = createAdminClient()

    // Build a preview for each parsed record: does the HBL match a BOL, and
    // what will change once applied?
    const preview = await Promise.all(
      records.map(async (rec) => {
        const hbl = rec.hbl.trim()

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
