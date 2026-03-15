import { createClient } from "@/lib/supabase/server"

/* ── Types ── */

export interface ContainerItem {
  id: string
  sku: string
  qty: number
  gw_kg: number
  unit_price_usd: number
  amount_usd: number
  whi_po: string
}

export interface ContainerGroup {
  id: string
  container: string
  type: string
  status: string
  items: ContainerItem[]
}

export interface BOLSummary {
  id: string
  invoice: string
  bol: string
  supplier: string
  customer: string
  containerCount: number
  status: string
  etd: string
  eta: string
  totalAmount: number
  totalWeight: number
  poCount: number
  pos: string[]
  containers: ContainerGroup[]
}

/* ── Server-side data fetching ── */

export async function fetchAllBOLSummaries(): Promise<BOLSummary[]> {
  const supabase = await createClient()

  const { data: shipments, error } = await supabase
    .from("shipments")
    .select(`
      id,
      invoice,
      bol,
      supplier,
      customer,
      etd,
      eta,
      status,
      containers (
        id,
        container,
        type,
        status,
        container_items (
          id,
          sku,
          qty,
          gw_kg,
          unit_price_usd,
          amount_usd,
          whi_po
        )
      )
    `)
    .order("etd", { ascending: false })

  if (error) {
    console.error("Failed to fetch shipments:", error)
    return []
  }

  return (shipments ?? []).map((s) => {
    const containers: ContainerGroup[] = (s.containers ?? []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      container: c.container as string,
      type: c.type as string,
      status: c.status as string,
      items: ((c.container_items as Record<string, unknown>[]) ?? []).map((i: Record<string, unknown>) => ({
        id: i.id as string,
        sku: i.sku as string,
        qty: Number(i.qty),
        gw_kg: Number(i.gw_kg),
        unit_price_usd: Number(i.unit_price_usd),
        amount_usd: Number(i.amount_usd),
        whi_po: i.whi_po as string,
      })),
    }))

    const allItems = containers.flatMap((c) => c.items)
    const uniquePOs = [...new Set(allItems.map((i) => i.whi_po))]

    return {
      id: s.id,
      invoice: s.invoice,
      bol: s.bol,
      supplier: s.supplier,
      customer: s.customer,
      containerCount: containers.length,
      status: s.status as string,
      etd: s.etd,
      eta: s.eta,
      totalAmount: allItems.reduce((sum, i) => sum + i.amount_usd, 0),
      totalWeight: allItems.reduce((sum, i) => sum + i.gw_kg, 0),
      poCount: uniquePOs.length,
      pos: uniquePOs,
      containers,
    }
  })
}

export async function fetchBOLByBol(bol: string): Promise<BOLSummary | null> {
  const supabase = await createClient()

  const { data: shipments, error } = await supabase
    .from("shipments")
    .select(`
      id,
      invoice,
      bol,
      supplier,
      customer,
      etd,
      eta,
      status,
      containers (
        id,
        container,
        type,
        status,
        container_items (
          id,
          sku,
          qty,
          gw_kg,
          unit_price_usd,
          amount_usd,
          whi_po
        )
      )
    `)
    .eq("bol", bol)
    .limit(1)

  if (error || !shipments || shipments.length === 0) {
    return null
  }

  const s = shipments[0]
  const containers: ContainerGroup[] = (s.containers ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    container: c.container as string,
    type: c.type as string,
    status: c.status as string,
    items: ((c.container_items as Record<string, unknown>[]) ?? []).map((i: Record<string, unknown>) => ({
      id: i.id as string,
      sku: i.sku as string,
      qty: Number(i.qty),
      gw_kg: Number(i.gw_kg),
      unit_price_usd: Number(i.unit_price_usd),
      amount_usd: Number(i.amount_usd),
      whi_po: i.whi_po as string,
    })),
  }))

  const allItems = containers.flatMap((c) => c.items)
  const uniquePOs = [...new Set(allItems.map((i) => i.whi_po))]

  return {
    id: s.id,
    invoice: s.invoice,
    bol: s.bol,
    supplier: s.supplier,
    customer: s.customer,
    containerCount: containers.length,
    status: s.status as string,
    etd: s.etd,
    eta: s.eta,
    totalAmount: allItems.reduce((sum, i) => sum + i.amount_usd, 0),
    totalWeight: allItems.reduce((sum, i) => sum + i.gw_kg, 0),
    poCount: uniquePOs.length,
    pos: uniquePOs,
    containers,
  }
}
