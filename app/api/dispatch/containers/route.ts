import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const TENANT = "whi"

/** Accepts an empty string / null (to clear) or a YYYY-MM-DD date string. */
function normalizeDate(value: unknown): string | null {
  if (value == null || value === "") return null
  const str = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null
  return str
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function strOrNull(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s ? s : null
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Manually add a standalone container to the Dispatcher. This creates a real
 * shipment + shipment_container pair (both flagged is_manual) so the whole
 * existing pipeline — the order_management_view, the detail page, and every
 * inline edit route — works for it with no special casing.
 *
 * A container only appears in the Dispatcher once it has Arrived (ATA set), so
 * ATA defaults to today when the caller leaves it blank.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>

    const container = strOrNull(body.container)
    if (!container) {
      return NextResponse.json({ error: "Container number is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Reject duplicates so we never fork an existing container into two rows.
    const { data: existing } = await supabase
      .from("shipment_containers")
      .select("id")
      .eq("container_number", container)
      .limit(1)
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `Container ${container} already exists` },
        { status: 409 },
      )
    }

    const now = new Date().toISOString()
    const shipmentId = crypto.randomUUID()
    const containerId = crypto.randomUUID()

    const etd = normalizeDate(body.etd)
    const eta = normalizeDate(body.eta)
    const ata = normalizeDate(body.ata) ?? today()

    const shipmentRow = {
      id: shipmentId,
      tenant_id: TENANT,
      is_manual: true,
      supplier: strOrNull(body.supplier),
      customer: strOrNull(body.customer),
      bol_number: strOrNull(body.bol),
      invoice_number: strOrNull(body.invoice),
      etd,
      eta,
      eta_original: eta,
      created_at: now,
      updated_at: now,
    }

    const { error: shipmentError } = await supabase.from("shipments").insert(shipmentRow)
    if (shipmentError) {
      console.error("[v0] add container (shipment) error:", shipmentError.message)
      return NextResponse.json({ error: shipmentError.message }, { status: 500 })
    }

    const containerRow = {
      id: containerId,
      shipment_id: shipmentId,
      tenant_id: TENANT,
      is_manual: true,
      container_number: container,
      container_type: strOrNull(body.containerType),
      sku: strOrNull(body.sku),
      po_number: strOrNull(body.po),
      quantity: numOrNull(body.quantity),
      gross_weight: numOrNull(body.grossWeight),
      total_amount: numOrNull(body.totalAmount),
      etd,
      etd_original: etd,
      atd: normalizeDate(body.atd),
      eta,
      eta_original: eta,
      ata,
      lfd: normalizeDate(body.lfd),
      planned_pickup_date: normalizeDate(body.plannedPickupDate),
      destination: strOrNull(body.warehouse),
      trucking_company: strOrNull(body.vendor),
      dispatch_status: strOrNull(body.dispatchStatus),
    }

    const { error: containerError } = await supabase
      .from("shipment_containers")
      .insert(containerRow)
    if (containerError) {
      // Roll back the orphaned shipment we just created.
      await supabase.from("shipments").delete().eq("id", shipmentId).eq("is_manual", true)
      console.error("[v0] add container (container) error:", containerError.message)
      return NextResponse.json({ error: containerError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, container })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add container"
    console.error("[v0] add container error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Delete a manually-added container (and its parent shipment). Only rows
 * flagged is_manual are ever touched, so real imported shipments are safe.
 *
 * Body: { container: string }
 */
export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { container?: string }
    const container = body.container?.trim()
    if (!container) {
      return NextResponse.json({ error: "container is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Find the manual container rows and the shipments they belong to.
    const { data: rows, error: findError } = await supabase
      .from("shipment_containers")
      .select("id, shipment_id")
      .eq("container_number", container)
      .eq("is_manual", true)

    if (findError) {
      console.error("[v0] delete container (find) error:", findError.message)
      return NextResponse.json({ error: findError.message }, { status: 500 })
    }
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "No manually-added container found to delete" },
        { status: 404 },
      )
    }

    const shipmentIds = [...new Set(rows.map((r) => r.shipment_id as string))]

    const { error: delContainersError } = await supabase
      .from("shipment_containers")
      .delete()
      .eq("container_number", container)
      .eq("is_manual", true)
    if (delContainersError) {
      console.error("[v0] delete container error:", delContainersError.message)
      return NextResponse.json({ error: delContainersError.message }, { status: 500 })
    }

    // Remove parent shipments only if they were manual and now have no
    // remaining containers.
    for (const sid of shipmentIds) {
      const { data: remaining } = await supabase
        .from("shipment_containers")
        .select("id")
        .eq("shipment_id", sid)
        .limit(1)
      if (!remaining || remaining.length === 0) {
        await supabase.from("shipments").delete().eq("id", sid).eq("is_manual", true)
      }
    }

    return NextResponse.json({ ok: true, deleted: rows.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete container"
    console.error("[v0] delete container error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
