import { createClient } from "@/lib/supabase/server"
import { deriveTrackingStatus, representativeStatus } from "@/lib/status"

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
  // Per-container tracking dates used to color the ETD/ATD & ETA/ATA cells.
  etd: string | null
  etd_original: string | null
  atd: string | null
  eta: string | null
  eta_original: string | null
  ata: string | null
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
  // BOL-level tracking (representative container) for cell coloring.
  etd_original: string | null
  atd: string | null
  eta_original: string | null
  ata: string | null
  totalAmount: number
  totalWeight: number
  poCount: number
  pos: string[]
  containers: ContainerGroup[]
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
  etd_original: string | null
  atd: string | null
  eta_original: string | null
  ata: string | null
}

/* ── Helpers ── */

// The view is denormalized to one row per SKU/container/shipment line. We group
// these rows into BOL (shipment) -> container -> item hierarchies in JS.
function groupRowsToBOLs(rows: ViewRow[]): BOLSummary[] {
  const bolMap = new Map<string, BOLSummary>()
  // bolKey -> containerName -> ContainerGroup
  const containerMap = new Map<string, Map<string, ContainerGroup>>()
  let itemSeq = 0

  for (const r of rows) {
    const bol = r.bl_no ?? ""
    const invoice = r.invoice ?? ""
    // A shipment is uniquely identified by invoice + bl_no.
    const bolKey = `${invoice}__${bol}`

    if (!bolMap.has(bolKey)) {
      bolMap.set(bolKey, {
        id: bol || invoice,
        invoice,
        bol,
        supplier: r.supplier ?? "",
        customer: r.customer ?? "",
        containerCount: 0,
        // Derived below from the container statuses once grouping is done.
        status: deriveTrackingStatus({ atd: r.atd, ata: r.ata }),
        etd: r.etd ?? "",
        eta: r.eta ?? "",
        etd_original: r.etd_original ?? null,
        atd: r.atd ?? null,
        eta_original: r.eta_original ?? null,
        ata: r.ata ?? null,
        totalAmount: 0,
        totalWeight: 0,
        poCount: 0,
        pos: [],
        containers: [],
      })
      containerMap.set(bolKey, new Map())
    }

    const summary = bolMap.get(bolKey)!
    const containers = containerMap.get(bolKey)!
    const containerName = r.container ?? "—"

    if (!containers.has(containerName)) {
      containers.set(containerName, {
        id: containerName,
        container: containerName,
        type: r.type ?? "",
        status: deriveTrackingStatus({ atd: r.atd, ata: r.ata }),
        items: [],
        etd: r.etd ?? null,
        etd_original: r.etd_original ?? null,
        atd: r.atd ?? null,
        eta: r.eta ?? null,
        eta_original: r.eta_original ?? null,
        ata: r.ata ?? null,
      })
    }

    const containerGroup = containers.get(containerName)!
    const amount = Number(r.amount_usd ?? 0)
    const weight = Number(r.gw_kg ?? 0)

    containerGroup.items.push({
      id: `${bolKey}-${containerName}-${itemSeq++}`,
      sku: r.sku ?? "",
      qty: Number(r.qty ?? 0),
      gw_kg: weight,
      unit_price_usd: Number(r.unit_price_usd ?? 0),
      amount_usd: amount,
      whi_po: r.whi_po ?? "",
    })

    summary.totalAmount += amount
    summary.totalWeight += weight
  }

  // Finalize: attach containers, counts, PO list.
  const result: BOLSummary[] = []
  for (const [bolKey, summary] of bolMap) {
    const containers = Array.from(containerMap.get(bolKey)!.values())
    summary.containers = containers
    summary.containerCount = containers.length
    // The BOL shows the least-advanced status across its containers so it isn't
    // marked "Arrived" while part of the shipment is still in transit / pending.
    summary.status = representativeStatus(containers.map((c) => c.status))
    const allItems = containers.flatMap((c) => c.items)
    const uniquePOs = [...new Set(allItems.map((i) => i.whi_po).filter(Boolean))]
    summary.pos = uniquePOs
    summary.poCount = uniquePOs.length
    result.push(summary)
  }

  return result
}

/* ── Server-side data fetching ── */

export async function fetchAllBOLSummaries(): Promise<BOLSummary[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("order_management_view")
    .select("*")

  if (error) {
    console.error("Failed to fetch order_management_view:", error)
    return []
  }

  const summaries = groupRowsToBOLs((data ?? []) as ViewRow[])
  return summaries.sort(
    (a, b) => new Date(b.etd).getTime() - new Date(a.etd).getTime()
  )
}

export async function fetchBOLByBol(bol: string): Promise<BOLSummary | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("order_management_view")
    .select("*")
    .eq("bl_no", bol)

  if (error || !data || data.length === 0) {
    return null
  }

  const summaries = groupRowsToBOLs(data as ViewRow[])
  return summaries[0] ?? null
}
