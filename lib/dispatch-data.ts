import { createClient } from "@/lib/supabase/server"
import { statusLabel } from "@/lib/status"

/* ── Types ── */

export interface DispatchContainer {
  id: string
  container: string
  type: string
  status: string
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

/* ── View row shape (order_management_view) ── */

interface ViewRow {
  supplier: string | null
  customer: string | null
  invoice: string | null
  bl_no: string | null
  whi_po: string | null
  container: string | null
  type: string | null
  sku: string | null
  qty: number | null
  gw_kg: number | string | null
  unit_price_usd: number | string | null
  amount_usd: number | string | null
  etd: string | null
  eta: string | null
  status: string | null
}

/* ── Helpers ── */

// Group denormalized view rows by container number. The new schema has no
// container UUID exposed in the view, so the container number is used as the id.
function groupRowsToContainers(rows: ViewRow[]): DispatchContainer[] {
  const map = new Map<string, DispatchContainer>()

  for (const r of rows) {
    const containerName = r.container ?? ""
    if (!containerName) continue

    if (!map.has(containerName)) {
      map.set(containerName, {
        id: containerName,
        container: containerName,
        type: r.type ?? "",
        status: statusLabel(r.status),
        shipmentId: r.bl_no ?? r.invoice ?? "",
        invoice: r.invoice ?? "",
        bol: r.bl_no ?? "",
        supplier: r.supplier ?? "",
        customer: r.customer ?? "",
        etd: r.etd ?? "",
        eta: r.eta ?? "",
        totalQty: 0,
        totalWeight: 0,
        totalAmount: 0,
        skuCount: 0,
        items: [],
      })
    }

    const c = map.get(containerName)!
    const qty = Number(r.qty ?? 0)
    const weight = Number(r.gw_kg ?? 0)
    const amount = Number(r.amount_usd ?? 0)

    c.items.push({
      sku: r.sku ?? "",
      qty,
      gw_kg: weight,
      amount_usd: amount,
      whi_po: r.whi_po ?? "",
    })
    c.totalQty += qty
    c.totalWeight += weight
    c.totalAmount += amount
    c.skuCount = c.items.length
  }

  return Array.from(map.values())
}

/* ── Server-side data fetching ── */

export async function fetchAllContainers(): Promise<DispatchContainer[]> {
  const supabase = await createClient()

  // Dispatch only concerns containers that have cleared customs and are ready
  // for / in the process of inland delivery.
  const { data, error } = await supabase
    .from("order_management_view")
    .select("*")
    .eq("status", "CLEARED")

  if (error) {
    console.error("Failed to fetch order_management_view:", error)
    return []
  }

  const containers = groupRowsToContainers((data ?? []) as ViewRow[])
  return containers.sort((a, b) => a.container.localeCompare(b.container))
}

export async function fetchContainerById(
  containerNumber: string
): Promise<DispatchContainer | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("order_management_view")
    .select("*")
    .eq("container", containerNumber)

  if (error || !data || data.length === 0) {
    return null
  }

  const containers = groupRowsToContainers(data as ViewRow[])
  return containers[0] ?? null
}
