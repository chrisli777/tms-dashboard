import { createClient } from "@/lib/supabase/server"
import { representativeStatus, statusLabel } from "@/lib/status"

/* ── Types ── */

export interface OrderBOL {
  id: string
  invoice: string
  bol: string
  etd: string
  eta: string
  status: string
  containerCount: number
  itemCount: number
  totalAmount: number
  totalWeight: number
}

export interface PendingItem {
  id: string
  sku: string
  description: string | null
  qtyOrdered: number
  qtyReceived: number
  unitCost: number
  amount: number
  weight: number
}

export interface OrderSummary {
  id: string
  poNumber: string
  supplier: string
  customer: string
  orderDate: string
  status: string
  dueDate: string | null
  bolCount: number
  containerCount: number
  itemCount: number
  totalAmount: number
  totalWeight: number
  bols: OrderBOL[]
  pendingItems: PendingItem[]
  // Progress tracking
  totalQtyOrdered: number
  totalQtyReceived: number
  progressPercent: number
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

// The new backend exposes everything through order_management_view (one row per
// SKU/container/shipment line). Orders are derived by grouping rows on whi_po.
// purchase_orders / pending_items are managed by the Python backend and are not
// read here, so pending/progress data is derived from shipped lines (all
// shipped == 100%).
function groupRowsToOrders(rows: ViewRow[]): OrderSummary[] {
  const orderMap = new Map<string, OrderSummary>()
  // po -> bolKey -> OrderBOL
  const bolMap = new Map<string, Map<string, OrderBOL>>()
  // po -> bolKey -> set of container names
  const containerMap = new Map<string, Map<string, Set<string>>>()
  // po -> list of raw statuses (to pick representative status)
  const statusMap = new Map<string, string[]>()
  // po -> list of etds (to derive an order date)
  const etdMap = new Map<string, string[]>()

  for (const r of rows) {
    const po = r.whi_po ?? ""
    if (!po) continue

    if (!orderMap.has(po)) {
      orderMap.set(po, {
        id: po,
        poNumber: po,
        supplier: r.supplier ?? "",
        customer: r.customer ?? "",
        orderDate: r.etd ?? "",
        status: "Unknown",
        dueDate: null,
        bolCount: 0,
        containerCount: 0,
        itemCount: 0,
        totalAmount: 0,
        totalWeight: 0,
        bols: [],
        pendingItems: [],
        totalQtyOrdered: 0,
        totalQtyReceived: 0,
        progressPercent: 100,
      })
      bolMap.set(po, new Map())
      containerMap.set(po, new Map())
      statusMap.set(po, [])
      etdMap.set(po, [])
    }

    const order = orderMap.get(po)!
    const amount = Number(r.amount_usd ?? 0)
    const weight = Number(r.gw_kg ?? 0)
    const qty = Number(r.qty ?? 0)

    order.itemCount++
    order.totalAmount += amount
    order.totalWeight += weight
    order.totalQtyOrdered += qty
    order.totalQtyReceived += qty
    statusMap.get(po)!.push(r.status ?? "")
    if (r.etd) etdMap.get(po)!.push(r.etd)

    // BOL grouping (invoice + bl_no identifies a shipment)
    const bol = r.bl_no ?? ""
    const invoice = r.invoice ?? ""
    const bolKey = `${invoice}__${bol}`
    const bols = bolMap.get(po)!

    if (!bols.has(bolKey)) {
      bols.set(bolKey, {
        id: bol || invoice,
        invoice,
        bol,
        etd: r.etd ?? "",
        eta: r.eta ?? "",
        status: statusLabel(r.status),
        containerCount: 0,
        itemCount: 0,
        totalAmount: 0,
        totalWeight: 0,
      })
    }
    const bolEntry = bols.get(bolKey)!
    bolEntry.itemCount++
    bolEntry.totalAmount += amount
    bolEntry.totalWeight += weight

    // Track unique containers per BOL
    const containers = containerMap.get(po)!
    if (!containers.has(bolKey)) containers.set(bolKey, new Set())
    if (r.container) containers.get(bolKey)!.add(r.container)
  }

  // Finalize
  const result: OrderSummary[] = []
  for (const [po, order] of orderMap) {
    const bols = Array.from(bolMap.get(po)!.values())
    const containers = containerMap.get(po)!

    let containerTotal = 0
    for (const bol of bols) {
      const set = containers.get(`${bol.invoice}__${bol.bol}`)
      bol.containerCount = set?.size ?? 0
      containerTotal += bol.containerCount
    }

    order.bols = bols.sort(
      (a, b) => new Date(b.etd).getTime() - new Date(a.etd).getTime()
    )
    order.bolCount = bols.length
    order.containerCount = containerTotal
    order.status = representativeStatus(statusMap.get(po)!)

    // Order date = earliest ETD across the PO's shipments.
    const etds = etdMap.get(po)!.sort()
    order.orderDate = etds[0] ?? ""

    result.push(order)
  }

  return result
}

/* ── Server-side data fetching ── */

export async function fetchAllOrders(): Promise<OrderSummary[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("order_management_view")
    .select("*")

  if (error) {
    console.error("Failed to fetch order_management_view:", error)
    return []
  }

  const orders = groupRowsToOrders((data ?? []) as ViewRow[])
  return orders.sort(
    (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
  )
}

export async function fetchOrderByPO(poNumber: string): Promise<OrderSummary | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("order_management_view")
    .select("*")
    .eq("whi_po", poNumber)

  if (error || !data || data.length === 0) {
    return null
  }

  const orders = groupRowsToOrders(data as ViewRow[])
  return orders[0] ?? null
}
