import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { effectiveStatus } from "@/lib/status"
import { defaultWarehouseForSkus } from "@/lib/dispatch-options"

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
  // Per-container tracking dates, used for the manual ATD/ATA editor and cell
  // coloring on the container detail page.
  etd_original: string | null
  atd: string | null
  eta_original: string | null
  ata: string | null
  /** Manual post-arrival dispatch stage (null = defaults to Arrived). */
  dispatch_status: string | null
  /** Last Free Day — manually editable in the Dispatcher. */
  lfd: string | null
  /** Planned pickup date — manually editable in the Dispatcher. */
  planned_pickup_date: string | null
  /**
   * Destination warehouse. Defaults from SKUs (Moses Lake for HX 61415/824433,
   * else Kent) but is manually overridable and stored in `destination`.
   */
  warehouse: string
  /** Trucking company arranging pickup (stored in `trucking_company`). */
  vendor: string | null
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
  etd_original: string | null
  atd: string | null
  eta_original: string | null
  ata: string | null
  dispatch_status: string | null
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
        status: effectiveStatus({ atd: r.atd, ata: r.ata, dispatch_status: r.dispatch_status }),
        shipmentId: r.bl_no ?? r.invoice ?? "",
        invoice: r.invoice ?? "",
        bol: r.bl_no ?? "",
        supplier: r.supplier ?? "",
        customer: r.customer ?? "",
        etd: r.etd ?? "",
        eta: r.eta ?? "",
        etd_original: r.etd_original ?? null,
        atd: r.atd ?? null,
        eta_original: r.eta_original ?? null,
        ata: r.ata ?? null,
        dispatch_status: r.dispatch_status ?? null,
        // Filled in by a secondary query against shipment_containers below,
        // since order_management_view does not expose these columns.
        lfd: null,
        planned_pickup_date: null,
        warehouse: "Kent",
        vendor: null,
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

/**
 * The Dispatcher's manually-managed fields (LFD, planned pickup, destination
 * warehouse, trucking vendor) live on shipment_containers, which
 * order_management_view does not expose. The anon role can't read that base
 * table, so we use the admin client here (same as the write path). Rows of the
 * same container share these values, so we take the first non-null value.
 *
 * The warehouse is resolved as the stored `destination` override if present,
 * otherwise a default derived from the container's SKUs.
 */
async function mergeDispatchFields(containers: DispatchContainer[]): Promise<void> {
  const numbers = containers.map((c) => c.container).filter(Boolean)
  if (numbers.length === 0) return

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("shipment_containers")
    .select("container_number, lfd, planned_pickup_date, destination, trucking_company")
    .in("container_number", numbers)

  if (error) {
    console.error("Failed to fetch dispatch fields:", error)
    return
  }

  type MergedFields = {
    lfd: string | null
    planned_pickup_date: string | null
    destination: string | null
    trucking_company: string | null
  }
  const byContainer = new Map<string, MergedFields>()
  for (const row of (data ?? []) as {
    container_number: string | null
    lfd: string | null
    planned_pickup_date: string | null
    destination: string | null
    trucking_company: string | null
  }[]) {
    const key = row.container_number ?? ""
    if (!key) continue
    const existing = byContainer.get(key)
    byContainer.set(key, {
      lfd: existing?.lfd ?? row.lfd ?? null,
      planned_pickup_date: existing?.planned_pickup_date ?? row.planned_pickup_date ?? null,
      destination: existing?.destination ?? row.destination ?? null,
      trucking_company: existing?.trucking_company ?? row.trucking_company ?? null,
    })
  }

  for (const c of containers) {
    const fields = byContainer.get(c.container)
    c.lfd = fields?.lfd ?? null
    c.planned_pickup_date = fields?.planned_pickup_date ?? null
    // Stored override wins; otherwise fall back to the SKU-derived default.
    c.warehouse = fields?.destination ?? defaultWarehouseForSkus(c.items.map((i) => i.sku))
    c.vendor = fields?.trucking_company ?? null
  }
}

export async function fetchAllContainers(): Promise<DispatchContainer[]> {
  const supabase = await createClient()

  // Dispatch only concerns containers that have Arrived, i.e. an actual arrival
  // date (ATA) has been recorded. Once a shipment arrives it becomes eligible
  // for inland dispatch.
  const { data, error } = await supabase
    .from("order_management_view")
    .select("*")
    .not("ata", "is", null)

  if (error) {
    console.error("Failed to fetch order_management_view:", error)
    return []
  }

  const containers = groupRowsToContainers((data ?? []) as ViewRow[])
  await mergeDispatchFields(containers)
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
  await mergeDispatchFields(containers)
  return containers[0] ?? null
}
