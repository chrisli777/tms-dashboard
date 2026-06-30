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

    let updatedContainers = 0
    let matchedBols = 0
    const unmatched: string[] = []

    for (const rec of records) {
      const hbl = rec.hbl.trim()
      const mbl = rec.mbl?.trim() || null

      // bol_number may hold either the house or master B/L; match against both.
      const keys = [hbl, mbl].filter((v): v is string => !!v)
      const { data: shipments } = await supabase
        .from("shipments")
        .select("id")
        .in("bol_number", keys)

      const shipmentIds = (shipments ?? []).map((s) => s.id as string)
      if (shipmentIds.length === 0) {
        unmatched.push(hbl)
        continue
      }
      matchedBols++

      const { data: ctrs } = await supabase
        .from("shipment_containers")
        .select("id, etd, etd_original, atd, eta, eta_original, ata, tracking_status")
        .in("shipment_id", shipmentIds)

      for (const ctr of (ctrs ?? []) as (ContainerTracking & { id: string })[]) {
        const merged = mergeContainerTracking(ctr, rec)
        const { error } = await supabase
          .from("shipment_containers")
          .update({
            etd: merged.etd,
            etd_original: merged.etd_original,
            atd: merged.atd,
            eta: merged.eta,
            eta_original: merged.eta_original,
            ata: merged.ata,
            tracking_status: merged.tracking_status,
          })
          .eq("id", ctr.id)

        if (error) {
          console.error("[v0] container update error:", error.message)
        } else {
          updatedContainers++
        }
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
