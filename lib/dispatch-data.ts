import { createClient } from "@/lib/supabase/server"

/* ── Types ── */

export interface DispatchContainer {
  id: string
  container: string
  type: string
  status: "Cleared" | "In Transit"
  shipmentId: string
  invoice: string
  bol: string
  supplier: string
  customer: string
  etd: string
  eta: string
  totalQty: number
  totalWeight: number
  totalAmount: number
  skuCount: number
  items: {
    sku: string
    qty: number
    gw_kg: number
    amount_usd: number
    whi_po: string
  }[]
}

/* ── Server-side data fetching ── */

export async function fetchAllContainers(): Promise<DispatchContainer[]> {
  const supabase = await createClient()

  const { data: containers, error } = await supabase
    .from("containers")
    .select(`
      id,
      container,
      type,
      status,
      shipment_id,
      shipments (
        id,
        invoice,
        bol,
        supplier,
        customer,
        etd,
        eta
      ),
      container_items (
        sku,
        qty,
        gw_kg,
        amount_usd,
        whi_po
      )
    `)
    .order("container", { ascending: true })

  if (error) {
    console.error("Failed to fetch containers:", error)
    return []
  }

  return (containers ?? []).map((c) => {
    const shipment = c.shipments as Record<string, unknown> | null
    const items = (c.container_items as Record<string, unknown>[]) ?? []

    return {
      id: c.id,
      container: c.container,
      type: c.type,
      status: c.status as "Cleared" | "In Transit",
      shipmentId: c.shipment_id,
      invoice: (shipment?.invoice as string) ?? "",
      bol: (shipment?.bol as string) ?? "",
      supplier: (shipment?.supplier as string) ?? "",
      customer: (shipment?.customer as string) ?? "",
      etd: (shipment?.etd as string) ?? "",
      eta: (shipment?.eta as string) ?? "",
      totalQty: items.reduce((sum, i) => sum + Number(i.qty), 0),
      totalWeight: items.reduce((sum, i) => sum + Number(i.gw_kg), 0),
      totalAmount: items.reduce((sum, i) => sum + Number(i.amount_usd), 0),
      skuCount: items.length,
      items: items.map((i) => ({
        sku: i.sku as string,
        qty: Number(i.qty),
        gw_kg: Number(i.gw_kg),
        amount_usd: Number(i.amount_usd),
        whi_po: i.whi_po as string,
      })),
    }
  })
}

export async function fetchContainerById(containerId: string): Promise<DispatchContainer | null> {
  const supabase = await createClient()

  const { data: containers, error } = await supabase
    .from("containers")
    .select(`
      id,
      container,
      type,
      status,
      shipment_id,
      shipments (
        id,
        invoice,
        bol,
        supplier,
        customer,
        etd,
        eta
      ),
      container_items (
        sku,
        qty,
        gw_kg,
        amount_usd,
        whi_po
      )
    `)
    .eq("id", containerId)
    .limit(1)

  if (error || !containers || containers.length === 0) {
    return null
  }

  const c = containers[0]
  const shipment = c.shipments as Record<string, unknown> | null
  const items = (c.container_items as Record<string, unknown>[]) ?? []

  return {
    id: c.id,
    container: c.container,
    type: c.type,
    status: c.status as "Cleared" | "In Transit",
    shipmentId: c.shipment_id,
    invoice: (shipment?.invoice as string) ?? "",
    bol: (shipment?.bol as string) ?? "",
    supplier: (shipment?.supplier as string) ?? "",
    customer: (shipment?.customer as string) ?? "",
    etd: (shipment?.etd as string) ?? "",
    eta: (shipment?.eta as string) ?? "",
    totalQty: items.reduce((sum, i) => sum + Number(i.qty), 0),
    totalWeight: items.reduce((sum, i) => sum + Number(i.gw_kg), 0),
    totalAmount: items.reduce((sum, i) => sum + Number(i.amount_usd), 0),
    skuCount: items.length,
    items: items.map((i) => ({
      sku: i.sku as string,
      qty: Number(i.qty),
      gw_kg: Number(i.gw_kg),
      amount_usd: Number(i.amount_usd),
      whi_po: i.whi_po as string,
    })),
  }
}
