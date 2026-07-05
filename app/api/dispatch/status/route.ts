import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchTokenFromLabel, DISPATCH_STATUS_OPTIONS } from "@/lib/status"

export const runtime = "nodejs"

/**
 * Manually set a container's post-arrival dispatch stage (Dispatcher only).
 *
 * The allowed values are Arrived / Cleared / Scheduled / Closed. These are the
 * tail of the shipment state machine and are only meaningful once a container
 * has Arrived (which is why the control lives in the Dispatcher). "Arrived"
 * clears the override (dispatch_status = null) so the derived status shows.
 *
 * Body: { container: string, bol?: string, status: string }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      container?: string
      bol?: string
      status?: string
    }

    const container = body.container?.trim()
    if (!container) {
      return NextResponse.json({ error: "container is required" }, { status: 400 })
    }

    const status = body.status?.trim() ?? ""
    if (!DISPATCH_STATUS_OPTIONS.includes(status as (typeof DISPATCH_STATUS_OPTIONS)[number])) {
      return NextResponse.json(
        { error: `status must be one of: ${DISPATCH_STATUS_OPTIONS.join(", ")}` },
        { status: 400 },
      )
    }

    const dispatch_status = dispatchTokenFromLabel(status)
    const supabase = createAdminClient()

    // Optionally scope to a single shipment.
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
      .update({ dispatch_status })
      .eq("container_number", container)

    if (shipmentIds && shipmentIds.length > 0) {
      query = query.in("shipment_id", shipmentIds)
    }

    const { data, error } = await query.select("id")
    if (error) {
      console.error("[v0] dispatch status error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: data?.length ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update status"
    console.error("[v0] dispatch status error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
