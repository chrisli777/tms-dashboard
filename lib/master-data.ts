import { createClient } from "@/lib/supabase/server"
import { statusLabel } from "@/lib/status"

export interface MasterOrderRow {
  supplier: string
  customer: string
  invoice: string
  bl_no: string
  whi_po: string
  container: string
  type: string
  sku: string
  qty: number
  gw_kg: number
  unit_price_usd: number
  amount_usd: number
  etd: string | null
  eta: string | null
  status: string
  etd_original: string | null
  atd: string | null
  eta_original: string | null
  ata: string | null
}

export interface MasterDashboard {
  totalRows: number
  totalContainers: number
  totalValue: number
  totalQty: number
  clearedShipments: number
  inTransitShipments: number
  onWaterShipments: number
}

export interface TariffConfigRow {
  id: string
  sku: string
  supplier: string | null
  effective_month: string | null
  tariff_rate_pct: number | null
  tariff_amount_usd: number | null
  notes: string | null
}

export interface PriceQuoteRow {
  id: string
  quote_type: string | null
  sku: string
  supplier: string | null
  quarter: string | null
  price: number | null
  effective_date: string | null
}

export interface MasterData {
  dashboard: MasterDashboard
  orderManagement: MasterOrderRow[]
  tariffRates: TariffConfigRow[]
  priceQuotes: PriceQuoteRow[]
}

/**
 * Read-only master data sourced directly from the oms_management backend.
 * Computed analysis sheets (logistics / tariff savings / price verification /
 * profit) are produced by the Python backend and are not yet persisted, so
 * those sheets render empty until the backend lands them.
 */
export async function getMasterData(): Promise<MasterData> {
  const supabase = await createClient()

  const [{ data: viewRows }, { data: tariffRows }, { data: quoteRows }] = await Promise.all([
    supabase.from("order_management_view").select("*"),
    supabase.from("tariff_rates").select("*"),
    supabase.from("price_quotes").select("*"),
  ])

  const rows = (viewRows ?? []) as MasterOrderRow[]

  const containers = new Set(rows.map((r) => r.container).filter(Boolean))
  const totalValue = rows.reduce((sum, r) => sum + (Number(r.amount_usd) || 0), 0)
  const totalQty = rows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0)

  const byStatus = (label: string) =>
    rows.filter((r) => statusLabel(r.status) === label).length

  const dashboard: MasterDashboard = {
    totalRows: rows.length,
    totalContainers: containers.size,
    totalValue,
    totalQty,
    clearedShipments: byStatus("Arrived"),
    inTransitShipments: byStatus("In Transit"),
    onWaterShipments: byStatus("On Water"),
  }

  const tariffRates = ((tariffRows ?? []) as Record<string, unknown>[]).map((t) => ({
    id: String(t.id),
    sku: String(t.sku ?? ""),
    supplier: (t.supplier as string) ?? null,
    effective_month: (t.effective_month as string) ?? null,
    tariff_rate_pct: t.tariff_rate_pct != null ? Number(t.tariff_rate_pct) : null,
    tariff_amount_usd: t.tariff_amount_usd != null ? Number(t.tariff_amount_usd) : null,
    notes: (t.notes as string) ?? null,
  }))

  const priceQuotes = ((quoteRows ?? []) as Record<string, unknown>[]).map((q) => ({
    id: String(q.id),
    quote_type: (q.quote_type as string) ?? null,
    sku: String(q.sku ?? ""),
    supplier: (q.supplier as string) ?? null,
    quarter: (q.quarter as string) ?? null,
    price: q.price != null ? Number(q.price) : null,
    effective_date: (q.effective_date as string) ?? null,
  }))

  return { dashboard, orderManagement: rows, tariffRates, priceQuotes }
}
