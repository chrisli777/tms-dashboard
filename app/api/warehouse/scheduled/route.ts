import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

/**
 * List containers currently in the "Scheduled" dispatch stage whose status was
 * set to Scheduled within the given date range.
 *
 * The Warehouse Receiving page uses this to show which scheduled containers are
 * candidates for reconciliation against WMS arrivals.
 *
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * The range is inclusive of startDate and exclusive of the day after endDate.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 },
    )
  }

  try {
    const supabase = createAdminClient()

    // Include the whole endDate day by querying strictly before the next day.
    const endExclusive = new Date(endDate + "T00:00:00Z")
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)
    const endExclusiveIso = endExclusive.toISOString()

    const { data, error } = await supabase
      .from("shipment_containers")
      .select(
        "container_number, po_number, sku, quantity, dispatch_status, dispatch_status_changed_at, close_date, ata, shipment_id",
      )
      .eq("tenant_id", "whi")
      .eq("dispatch_status", "SCHEDULED")
      .gte("dispatch_status_changed_at", startDate + "T00:00:00Z")
      .lt("dispatch_status_changed_at", endExclusiveIso)
      .order("dispatch_status_changed_at", { ascending: false })

    if (error) {
      console.error("[v0] scheduled containers error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const containers = (data ?? []).map((c) => ({
      container: c.container_number as string,
      poNumber: (c.po_number as string) ?? "",
      sku: (c.sku as string) ?? "",
      quantity: (c.quantity as number) ?? 0,
      scheduledAt: c.dispatch_status_changed_at as string | null,
      ata: c.ata as string | null,
    }))

    return NextResponse.json({
      success: true,
      total: containers.length,
      containers,
      dateRange: { startDate, endDate },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load scheduled containers"
    console.error("[v0] scheduled containers error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
