import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeDate } from "@/lib/tracking-rules"

export const runtime = "nodejs"

/**
 * Manual ATD / ATA edit for a single container (Shipment Tracking).
 *
 * This is a deliberate, user-driven override: whatever ATD/ATA the user submits
 * is written verbatim (including clearing a value back to null). The derived
 * tracking_status is recomputed from the new actuals — ATA wins (Arrived),
 * else ATD (In Transit), else Pending. ETD/ETA estimates are left untouched.
 *
 * Body: { container: string, bol?: string, atd?: string|null, ata?: string|null }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      container?: string
      bol?: string
      atd?: string | null
      ata?: string | null
    }

    const container = body.container?.trim()
    if (!container) {
      return NextResponse.json({ error: "container is required" }, { status: 400 })
    }

    const atd = normalizeDate(body.atd)
    const ata = normalizeDate(body.ata)

    // ATA has the highest priority. Tokens mirror lib/tracking-rules merges.
    let tracking_status = "PENDING"
    if (atd) tracking_status = "IN_TRANSIT"
    if (ata) tracking_status = "CLEARED"

    const supabase = createAdminClient()

    // Optionally scope to a single shipment so we don't touch identically
    // numbered containers on other BOLs.
    let shipmentIds: string[] | null = null
    if (body.bol?.trim()) {
      const { data: shipments } = await supabase
        .from("shipments")
        .select("id")
        .eq("bol_number", body.bol.trim())
      shipmentIds = (shipments ?? []).map((s) => s.id as string)
    }

    let query = supabase
      .from("shipment_containers")
      .update({ atd, ata, tracking_status })
      .eq("container_number", container)

    if (shipmentIds && shipmentIds.length > 0) {
      query = query.in("shipment_id", shipmentIds)
    }

    const { data, error } = await query.select("id")
    if (error) {
      console.error("[v0] tracking edit error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: data?.length ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update tracking"
    console.error("[v0] tracking edit error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
