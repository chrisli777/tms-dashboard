import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  mergeContainerTracking,
  type ParsedTrackingRecord,
  type ContainerTracking,
} from "@/lib/tracking-rules"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Apply confirmed tracking records to the database. This is the single
 * controlled write path in an otherwise read-only app: it updates the
 * per-container tracking columns (etd / etd_original / atd / eta /
 * eta_original / ata / tracking_status) for every container under each
 * matched BOL, following the merge rules in lib/tracking-rules.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { records?: ParsedTrackingRecord[] }
    const records = (body.records ?? []).filter(
      (r) => r && typeof r.hbl === "string" && r.hbl.trim(),
    )

    if (records.length === 0) {
      return NextResponse.json({ error: "No records to apply" }, { status: 400 })
    }

    const supabase = createAdminClient()

    const unmatched: string[] = []

    // Process each BOL in parallel. Within a BOL, all containers receive the
    // same file values, so we group containers by their computed merged result
    // and issue one bulk update per distinct result (usually just one), instead
    // of a separate round-trip per container.
    const results = await Promise.all(
      records.map(async (rec) => {
        const hbl = rec.hbl.trim()
        const mbl = rec.mbl?.trim() || null

        // Match the House B/L against shipments.bol_number first; fall back to
        // the Master B/L if the HBL matches nothing.
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
          return { matched: false, hbl, updated: 0 }
        }

        const { data: ctrs } = await supabase
          .from("shipment_containers")
          .select("id, etd, etd_original, atd, eta, eta_original, ata, tracking_status")
          .in("shipment_id", shipmentIds)

        const containers = (ctrs ?? []) as (ContainerTracking & { id: string })[]

        // Group container ids by their merged update payload signature.
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

        return { matched: true, hbl, updated }
      }),
    )

    let updatedContainers = 0
    let matchedBols = 0
    for (const r of results) {
      if (r.matched) {
        matchedBols++
        updatedContainers += r.updated
      } else {
        unmatched.push(r.hbl)
      }
    }

    return NextResponse.json({
      ok: true,
      matchedBols,
      updatedContainers,
      unmatched,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to apply updates"
    console.error("[v0] upload apply error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
