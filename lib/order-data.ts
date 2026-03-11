import { createClient } from "@/lib/supabase/server"

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

/* ── Server-side data fetching ── */

export async function fetchAllOrders(): Promise<OrderSummary[]> {
  const supabase = await createClient()

  // Fetch orders
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .order("order_date", { ascending: false })

  if (ordersError || !orders) {
    console.error("Failed to fetch orders:", ordersError)
    return []
  }

  // Fetch all container_items with their container and shipment info
  const { data: items, error: itemsError } = await supabase
    .from("container_items")
    .select(`
      id,
      sku,
      qty,
      gw_kg,
      amount_usd,
      whi_po,
      order_id,
      container_id,
      containers (
        id,
        container,
        shipment_id,
        shipments (
          id,
          invoice,
          bol,
          etd,
          eta,
          status
        )
      )
    `)

  if (itemsError) {
    console.error("Failed to fetch container items:", itemsError)
    return []
  }

  // Fetch pending items for all orders
  const { data: pendingItemsData, error: pendingError } = await supabase
    .from("pending_items")
    .select("*")

  if (pendingError) {
    console.error("Failed to fetch pending items:", pendingError)
  }

  // Group pending items by order_id
  const pendingItemsByOrder = new Map<string, PendingItem[]>()
  for (const pi of pendingItemsData ?? []) {
    const orderId = pi.order_id
    if (!pendingItemsByOrder.has(orderId)) {
      pendingItemsByOrder.set(orderId, [])
    }
    pendingItemsByOrder.get(orderId)!.push({
      id: pi.id,
      sku: pi.sku,
      description: pi.description,
      qtyOrdered: Number(pi.qty_ordered),
      qtyReceived: Number(pi.qty_received),
      unitCost: Number(pi.unit_cost),
      amount: Number(pi.amount),
      weight: Number(pi.weight),
    })
  }

  // Group items by order
  const orderMap = new Map<string, OrderSummary>()

  for (const order of orders) {
    const pendingItems = pendingItemsByOrder.get(order.id) ?? []
    const totalQtyOrdered = pendingItems.reduce((sum, pi) => sum + pi.qtyOrdered, 0)
    const totalQtyReceived = pendingItems.reduce((sum, pi) => sum + pi.qtyReceived, 0)
    const progressPercent = totalQtyOrdered > 0 ? Math.round((totalQtyReceived / totalQtyOrdered) * 100) : 100

    orderMap.set(order.id, {
      id: order.id,
      poNumber: order.po_number,
      supplier: order.supplier,
      customer: order.customer,
      orderDate: order.order_date,
      status: order.status,
      dueDate: order.due_date,
      bolCount: 0,
      containerCount: 0,
      itemCount: 0,
      totalAmount: 0,
      totalWeight: 0,
      bols: [],
      pendingItems,
      totalQtyOrdered,
      totalQtyReceived,
      progressPercent,
    })
  }

  // Build BOL data per order
  const orderBOLMap = new Map<string, Map<string, OrderBOL>>()

  for (const item of items ?? []) {
    if (!item.order_id) continue

    const orderSummary = orderMap.get(item.order_id)
    if (!orderSummary) continue

    orderSummary.itemCount++
    orderSummary.totalAmount += Number(item.amount_usd)
    orderSummary.totalWeight += Number(item.gw_kg)

    // Get shipment info from nested data
    const container = item.containers as Record<string, unknown> | null
    if (!container) continue

    const shipment = container.shipments as Record<string, unknown> | null
    if (!shipment) continue

    const bolId = shipment.id as string

    if (!orderBOLMap.has(item.order_id)) {
      orderBOLMap.set(item.order_id, new Map())
    }

    const bolMap = orderBOLMap.get(item.order_id)!
    if (!bolMap.has(bolId)) {
      bolMap.set(bolId, {
        id: bolId,
        invoice: shipment.invoice as string,
        bol: shipment.bol as string,
        etd: shipment.etd as string,
        eta: shipment.eta as string,
        status: shipment.status as string,
        containerCount: 0,
        itemCount: 0,
        totalAmount: 0,
        totalWeight: 0,
      })
    }

    const bol = bolMap.get(bolId)!
    bol.itemCount++
    bol.totalAmount += Number(item.amount_usd)
    bol.totalWeight += Number(item.gw_kg)
  }

  // Count unique containers per BOL per order
  const orderContainerMap = new Map<string, Map<string, Set<string>>>()
  for (const item of items ?? []) {
    if (!item.order_id) continue
    
    const container = item.containers as Record<string, unknown> | null
    if (!container) continue
    
    const shipment = container.shipments as Record<string, unknown> | null
    if (!shipment) continue
    
    const bolId = shipment.id as string
    const containerId = container.id as string
    
    if (!orderContainerMap.has(item.order_id)) {
      orderContainerMap.set(item.order_id, new Map())
    }
    const bolContainerMap = orderContainerMap.get(item.order_id)!
    
    if (!bolContainerMap.has(bolId)) {
      bolContainerMap.set(bolId, new Set())
    }
    bolContainerMap.get(bolId)!.add(containerId)
  }

  // Update container counts and finalize
  for (const [orderId, bolMap] of orderBOLMap) {
    const orderSummary = orderMap.get(orderId)!
    const containerMap = orderContainerMap.get(orderId)
    
    const bols = Array.from(bolMap.values())
    for (const bol of bols) {
      const containerSet = containerMap?.get(bol.id)
      bol.containerCount = containerSet?.size ?? 0
      orderSummary.containerCount += bol.containerCount
    }
    
    orderSummary.bols = bols.sort((a, b) => 
      new Date(b.etd).getTime() - new Date(a.etd).getTime()
    )
    orderSummary.bolCount = bols.length
  }

  return Array.from(orderMap.values())
}

export async function fetchOrderByPO(poNumber: string): Promise<OrderSummary | null> {
  const allOrders = await fetchAllOrders()
  return allOrders.find(o => o.poNumber === poNumber) ?? null
}
