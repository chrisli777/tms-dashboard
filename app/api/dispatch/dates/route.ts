import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

/** The manually-editable Dispatcher date columns on shipment_containers. */
const EDITABLE_FIELDS = ["lfd", "planned_pickup_date"] as const
type EditableField = (typeof EDITABLE_FIELDS)[number]

/** Accepts an empty string / null (to clear) or a YYYY-MM-DD date string. */
function normalizeDate(value: unknown): string | null {
  if (value == null || value === "") return null
  const str = String(value).trim()
  if (!str) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null
  return str
}

/**
 * Manually set a container's LFD (Last Free Day) or planned pickup date
 * (Dispatcher only). Both are simple date columns on shipment_containers with no
 * lifecycle constraints — a container just needs to have Arrived to appear in
 * the Dispatcher at all.
 *
 * Body: { container: string, bol?: string, field: "lfd" | "planned_pickup_date", value: string | null }
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

    const field = body.field?.trim() as EditableField | undefined
    if (!field || !EDITABLE_FIELDS.includes(field)) {
      return NextResponse.json(
        { error: `field must be one of: ${EDITABLE_FIELDS.join(", ")}` },
        { status: 400 },
      )
    }

    if (body.value != null && body.value !== "" && normalizeDate(body.value) === null) {
      return NextResponse.json({ error: "value must be a YYYY-MM-DD date or empty" }, { status: 400 })
    }

    const nextValue = normalizeDate(body.value)
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
      .update({ [field]: nextValue })
      .eq("container_number", container)

    if (shipmentIds && shipmentIds.length > 0) {
      query = query.in("shipment_id", shipmentIds)
    }

    const { data, error } = await query.select("id")
    if (error) {
      console.error("[v0] dispatch dates error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: data?.length ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update date"
    console.error("[v0] dispatch dates error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
