import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  mergeContainerTracking,
  mergeContainerRecord,
  type ParsedTrackingRecord,
  type ParsedContainerRecord,
  type ContainerTracking,
} from "@/lib/tracking-rules"

export const runtime = "nodejs"
export const maxDuration = 60

type ReportFormat = "hbl" | "container"

/**
 * Apply confirmed tracking records to the database. This is the single
 * controlled write path in an otherwise read-only app. Two report formats are
 * supported:
 *
 *  - "hbl": matched against shipments.bol_number (HBL then MBL fallback); every
 *    container under each matched BOL is updated (etd / etd_original / atd /
 *    eta / eta_original / ata / tracking_status).
 *  - "container": matched directly on shipment_containers.container_number; only
 *    the matched container is updated (eta / eta_original / ata /
 *    tracking_status), following the container-report merge rules.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      records?: unknown[]
      format?: ReportFormat
    }
    const format: ReportFormat = body.format === "container" ? "container" : "hbl"

    if (format === "container") {
      return applyContainerRecords((body.records ?? []) as ParsedContainerRecord[])
    }
    return applyHblRecords((body.records ?? []) as ParsedTrackingRecord[])
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to apply updates"
    console.error("[v0] upload apply error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** HBL format: update all containers under each matched BOL. */
async function applyHblRecords(input: ParsedTrackingRecord[]) {
  const records = input.filter((r) => r && typeof r.hbl === "string" && r.hbl.trim())
  if (records.length === 0) {
    return NextResponse.json({ error: "No records to apply" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const unmatched: string[] = []

  // Process each BOL in parallel. Within a BOL, all containers receive the
  // same file values, so we group containers by their computed merged result
  // and issue one bulk update per distinct result (usually just one).
  const results = await Promise.all(
    records.map(async (rec) => {
      const hbl = rec.hbl.trim()
      const mbl = rec.mbl?.trim() || null

      let { data: shipments } = await supabase
        .from("shipments")
        .select("id")
        .eq("bol_number", hbl)

      if ((shipments?.length ?? 0) === 0 && mbl) {
        const res = await supabase.from("shipments").select("id").eq("bol_number", mbl)
        shipments = res.data
      }

      const shipmentIds = (shipments ?? []).map((s) => s.id as string)
      if (shipmentIds.length === 0) {
        return { matched: false, key: hbl, updated: 0 }
      }

      const { data: ctrs } = await supabase
        .from("shipment_containers")
        .select("id, etd, etd_original, atd, eta, eta_original, ata, tracking_status")
        .in("shipment_id", shipmentIds)

      const containers = (ctrs ?? []) as (ContainerTracking & { id: string })[]

      const groups = new Map<string, { payload: Record<string, unknown>; ids: string[] }>()
      for (const ctr of containers) {
        const merged = mergeContainerTracking(ctr, rec)
        const payload = {
          etd: merged.etd,
          etd_original: merged.etd_original,
          atd: merged.atd,
          eta: merged.eta,
          eta_original: merged.eta_original,
          ata: merged.ata,
          tracking_status: merged.tracking_status,
        }
        const sig = JSON.stringify(payload)
        const group = groups.get(sig)
        if (group) group.ids.push(ctr.id)
        else groups.set(sig, { payload, ids: [ctr.id] })
      }

      let updated = 0
      await Promise.all(
        [...groups.values()].map(async ({ payload, ids }) => {
          const { error } = await supabase
            .from("shipment_containers")
            .update(payload)
            .in("id", ids)
          if (error) console.error("[v0] container update error:", error.message)
          else updated += ids.length
        }),
      )

      return { matched: true, key: hbl, updated }
    }),
  )

  return summarize(results, unmatched)
}

/** Container format: update each matched container_number directly. */
async function applyContainerRecords(input: ParsedContainerRecord[]) {
  const records = input.filter(
    (r) => r && typeof r.container === "string" && r.container.trim(),
  )
  if (records.length === 0) {
    return NextResponse.json({ error: "No records to apply" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const unmatched: string[] = []

  const wanted = Array.from(
    new Set(records.map((r) => r.container.trim().toUpperCase()).filter(Boolean)),
  )

  // Fetch every matching container up front, grouped by (upper-cased) number so
  // duplicates across shipments are all updated.
  const byNumber = new Map<string, (ContainerTracking & { id: string })[]>()
  if (wanted.length > 0) {
    const { data: ctrs } = await supabase
      .from("shipment_containers")
      .select("id, container_number, etd, etd_original, atd, eta, eta_original, ata, tracking_status")
      .in("container_number", wanted)
    for (const c of ctrs ?? []) {
      const key = String((c as { container_number: string }).container_number).toUpperCase()
      const list = byNumber.get(key)
      if (list) list.push(c as ContainerTracking & { id: string })
      else byNumber.set(key, [c as ContainerTracking & { id: string }])
    }
  }

  const results = await Promise.all(
    records.map(async (rec) => {
      const label = rec.container.trim()
      const rows = byNumber.get(label.toUpperCase()) ?? []
      if (rows.length === 0) {
        return { matched: false, key: label, updated: 0 }
      }

      let updated = 0
      await Promise.all(
        rows.map(async (row) => {
          const merged = mergeContainerRecord(row, rec)
          const { error } = await supabase
            .from("shipment_containers")
            .update({
              eta: merged.eta,
              eta_original: merged.eta_original,
              ata: merged.ata,
              tracking_status: merged.tracking_status,
            })
            .eq("id", row.id)
          if (error) console.error("[v0] container update error:", error.message)
          else updated += 1
        }),
      )

      return { matched: true, key: label, updated }
    }),
  )

  return summarize(results, unmatched)
}

function summarize(
  results: { matched: boolean; key: string; updated: number }[],
  unmatched: string[],
) {
  let updatedContainers = 0
  let matchedBols = 0
  for (const r of results) {
    if (r.matched) {
      matchedBols++
      updatedContainers += r.updated
    } else {
      unmatched.push(r.key)
    }
  }

  return NextResponse.json({
    ok: true,
    matchedBols,
    updatedContainers,
    unmatched,
  })
}
