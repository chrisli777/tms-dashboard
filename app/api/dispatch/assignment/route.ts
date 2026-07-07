import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

/**
 * Manually-editable Dispatcher assignment columns. Map the UI field names onto
 * the underlying shipment_containers columns:
 *  - warehouse -> destination
 *  - vendor    -> trucking_company
 */
const FIELD_TO_COLUMN = {
  warehouse: "destination",
  vendor: "trucking_company",
} as const
type AssignmentField = keyof typeof FIELD_TO_COLUMN

/**
 * Set a container's destination warehouse or trucking vendor (Dispatcher only).
 *
 * Body: { container: string, bol?: string, field: "warehouse" | "vendor", value: string | null }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      container?: string
      bol?: string
      field?: string
      value?: string | null
    }

    const container = body.container?.trim()
    if (!container) {
      return NextResponse.json({ error: "container is required" }, { status: 400 })
    }

    const field = body.field?.trim() as AssignmentField | undefined
    if (!field || !(field in FIELD_TO_COLUMN)) {
      return NextResponse.json(
        { error: `field must be one of: ${Object.keys(FIELD_TO_COLUMN).join(", ")}` },
        { status: 400 },
      )
    }

    const column = FIELD_TO_COLUMN[field]
    const raw = body.value == null ? null : String(body.value).trim()
    const nextValue = raw ? raw : null

    const supabase = createAdminClient()

    // Optionally scope to a single shipment (matched by BOL number).
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
      .update({ [column]: nextValue })
      .eq("container_number", container)

    if (shipmentIds && shipmentIds.length > 0) {
      query = query.in("shipment_id", shipmentIds)
    }

    const { data, error } = await query.select("id")
    if (error) {
      console.error("[v0] dispatch assignment error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: data?.length ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update assignment"
    console.error("[v0] dispatch assignment error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
