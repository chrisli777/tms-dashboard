import { NextResponse } from "next/server"
import { generateText, Output } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// SKILL: scm-master-generator
// 根据 Order Management 数据 + 配置 + CVAS费用，生成完整的 Master 8 sheets

const MASTER_GENERATOR_SKILL = `You are a Supply Chain Master Table Generator. Your job is to process order management data and generate comprehensive analysis across 8 sheets.

## Input Data Structure
You will receive:
1. orderManagement: 15-column order data (WHI_PO, Invoice, BOL, Vessel, ETD, ETA, Container, ContainerType, SKU, Qty, Weight, Unit_Price, Amount, Supplier, Customer)
2. skuTariffs: SKU tariff configuration (sku, hts_code, theoretical_rate, actual_rate)
3. customerQuotations: Customer pricing (customer, sku, quoted_price)
4. supplierQuotations: Supplier pricing (supplier, sku, quoted_price)
5. cvasLogisticsCosts: Freight costs by BOL (bol, sea_freight, customs_fee, domestic_freight)

## Output: 8 Sheets

### Sheet 1: Dashboard Metrics
Calculate KPIs:
- total_shipments: Count unique BOLs
- total_containers: Count unique Container numbers
- total_value: Sum of all Amount
- cleared_shipments: Count BOLs with status "Customs Cleared"
- in_transit_shipments: Count BOLs with status "On Water"
- theoretical_tariff: Sum(EXW_Value × theoretical_rate) for all SKUs
- actual_tariff: Sum(EXW_Value × actual_rate) for all SKUs
- tariff_savings: theoretical_tariff - actual_tariff
- tariff_savings_rate: tariff_savings / theoretical_tariff

### Sheet 2: Order Management (pass through)
Return the 15-column order data as-is.

### Sheet 3: Logistics Cost Allocation (物流费用分摊)
For each BOL's total freight, allocate to SKUs by weight share:
- weight_share = sku_weight / bol_total_weight
- sea_freight = bol_sea_freight × weight_share
- customs_fee = bol_customs_fee × weight_share
- domestic_freight = bol_domestic_freight × weight_share
- total_freight = sea_freight + customs_fee + domestic_freight
- unit_freight = total_freight / quantity

### Sheet 4: Tariff Allocation (关税分摊)
For each SKU:
- Look up theoretical_rate and actual_rate from skuTariffs
- exw_value = unit_price × quantity
- theoretical_tariff = exw_value × theoretical_rate
- actual_tariff = exw_value × actual_rate
- unit_tariff = actual_tariff / quantity
- savings = theoretical_tariff - actual_tariff

### Sheet 5: Price Verification (价格核对)
For each SKU:
- supplier_invoice_price = unit_price from order
- supplier_quoted_price = quoted_price from supplierQuotations
- supplier_variance = supplier_invoice_price - supplier_quoted_price
- customer_total_price = quoted_price from customerQuotations
- margin_per_unit = customer_total_price - supplier_invoice_price
- has_alert = true if |supplier_variance| > 0.01 or margin_per_unit < 0
- alert_message = describe the variance issue

### Sheet 6: Profit Analysis (利润分析)
For each SKU:
- customer_quote_unit = from customerQuotations
- exw_cost = supplier_invoice_price
- freight_cost = unit_freight from logistics allocation
- tariff_cost = unit_tariff from tariff allocation
- total_cost_unit = exw_cost + freight_cost + tariff_cost
- gross_profit_unit = customer_quote_unit - total_cost_unit
- margin_percent = gross_profit_unit / customer_quote_unit × 100
- is_provisional = true if any cost component is estimated/missing
- status = "Alert" if margin_percent < 5, "Warning" if < 10, else "Normal"

### Sheet 7: Container Details (装箱原始)
Group by Container, show:
- container_number, container_type
- list of SKUs with qty, weight
- total_weight, total_qty, total_value

### Sheet 8: Configuration Summary
Return current config state:
- sku_count: number of SKUs with tariff config
- customer_quote_count: number of customer quotations
- supplier_quote_count: number of supplier quotations
- missing_tariffs: list of SKUs without tariff config
- missing_quotes: list of SKU/customer pairs without quotes

## Important Rules
1. If tariff config is missing for a SKU, use theoretical_rate=0.25 and actual_rate=0.10 as defaults
2. If customer/supplier quote is missing, mark as "Missing" and set is_provisional=true
3. Always round monetary values to 2 decimal places
4. Always round percentages to 4 decimal places
5. Flag any data quality issues in the alerts array
`

// Output schema for the Master Table
const masterOutputSchema = z.object({
  dashboard: z.object({
    totalShipments: z.number(),
    totalContainers: z.number(),
    totalValue: z.number(),
    clearedShipments: z.number(),
    inTransitShipments: z.number(),
    theoreticalTariff: z.number(),
    actualTariff: z.number(),
    tariffSavings: z.number(),
    tariffSavingsRate: z.number(),
  }),
  logisticsAllocations: z.array(z.object({
    bol: z.string(),
    sku: z.string(),
    quantity: z.number(),
    weightKg: z.number(),
    weightShare: z.number(),
    seaFreight: z.number(),
    customsFee: z.number(),
    domesticFreight: z.number(),
    totalFreight: z.number(),
    unitFreight: z.number(),
  })),
  tariffAllocations: z.array(z.object({
    bol: z.string(),
    sku: z.string(),
    quantity: z.number(),
    htsCode: z.string().nullable(),
    theoreticalRate: z.number(),
    actualRate: z.number(),
    exwValue: z.number(),
    theoreticalTariff: z.number(),
    actualTariff: z.number(),
    unitTariff: z.number(),
    savings: z.number(),
  })),
  priceVerifications: z.array(z.object({
    sku: z.string(),
    quantity: z.number(),
    supplierInvoicePrice: z.number(),
    supplierQuotedPrice: z.number().nullable(),
    supplierVariance: z.number().nullable(),
    customerTotalPrice: z.number().nullable(),
    marginPerUnit: z.number().nullable(),
    hasAlert: z.boolean(),
    alertMessage: z.string().nullable(),
  })),
  profitAnalysis: z.array(z.object({
    sku: z.string(),
    quantity: z.number(),
    customerQuoteUnit: z.number().nullable(),
    exwCost: z.number(),
    freightCost: z.number(),
    tariffCost: z.number(),
    totalCostUnit: z.number(),
    grossProfitUnit: z.number().nullable(),
    marginPercent: z.number().nullable(),
    isProvisional: z.boolean(),
    status: z.string(),
  })),
  containerDetails: z.array(z.object({
    containerNumber: z.string(),
    containerType: z.string(),
    items: z.array(z.object({
      sku: z.string(),
      qty: z.number(),
      weight: z.number(),
    })),
    totalWeight: z.number(),
    totalQty: z.number(),
    totalValue: z.number(),
  })),
  configSummary: z.object({
    skuCount: z.number(),
    customerQuoteCount: z.number(),
    supplierQuoteCount: z.number(),
    missingTariffs: z.array(z.string()),
    missingQuotes: z.array(z.string()),
  }),
  alerts: z.array(z.object({
    type: z.string(),
    message: z.string(),
    sku: z.string().nullable(),
  })),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Fetch all required data from the database
    const [
      { data: shipments },
      { data: containers },
      { data: containerItems },
      { data: skuTariffs },
      { data: customerQuotations },
      { data: supplierQuotations },
      { data: cvasLogisticsCosts },
    ] = await Promise.all([
      supabase.from("shipments").select("*"),
      supabase.from("containers").select("*"),
      supabase.from("container_items").select("*, containers(*, shipments(*))"),
      supabase.from("config_sku_tariffs").select("*"),
      supabase.from("config_customer_quotations").select("*"),
      supabase.from("config_supplier_quotations").select("*"),
      supabase.from("cvas_logistics_costs").select("*"),
    ])

    // Build Order Management 15-column data from container_items
    const orderManagement = (containerItems ?? []).map((item: Record<string, unknown>) => {
      const container = item.containers as Record<string, unknown> | null
      const shipment = container?.shipments as Record<string, unknown> | null
      return {
        whi_po: item.order_id ?? "",
        invoice: shipment?.invoice_number ?? "",
        bol: shipment?.bol ?? "",
        vessel: shipment?.vessel ?? "",
        etd: shipment?.etd ?? "",
        eta: shipment?.eta ?? "",
        container: container?.container_number ?? "",
        container_type: container?.container_type ?? "",
        sku: item.sku ?? "",
        qty: item.qty ?? 0,
        weight: item.weight ?? 0,
        unit_price: item.unit_price ?? item.unit_cost ?? 0,
        amount: item.amount ?? 0,
        supplier: item.supplier ?? shipment?.supplier ?? "",
        customer: item.customer ?? "",
      }
    })

    // Call Claude to generate the Master Table analysis
    const result = await generateText({
      model: "anthropic/claude-sonnet-4-20250514",
      system: MASTER_GENERATOR_SKILL,
      messages: [
        {
          role: "user",
          content: `Generate Master Table analysis from the following data:

## Order Management Data (${orderManagement.length} rows)
${JSON.stringify(orderManagement.slice(0, 100), null, 2)}
${orderManagement.length > 100 ? `\n... and ${orderManagement.length - 100} more rows` : ""}

## SKU Tariff Configuration (${skuTariffs?.length ?? 0} entries)
${JSON.stringify(skuTariffs ?? [], null, 2)}

## Customer Quotations (${customerQuotations?.length ?? 0} entries)
${JSON.stringify(customerQuotations ?? [], null, 2)}

## Supplier Quotations (${supplierQuotations?.length ?? 0} entries)
${JSON.stringify(supplierQuotations ?? [], null, 2)}

## CVAS Logistics Costs (${cvasLogisticsCosts?.length ?? 0} entries)
${JSON.stringify(cvasLogisticsCosts ?? [], null, 2)}

Please analyze this data and generate the complete 8-sheet Master Table output.`,
        },
      ],
      output: Output.object({ schema: masterOutputSchema }),
    })

    const masterData = result.output

    // Save results to database
    const today = new Date().toISOString().split("T")[0]

    // 1. Save Dashboard Metrics
    if (masterData?.dashboard) {
      await supabase.from("master_dashboard_metrics").upsert({
        snapshot_date: today,
        total_shipments: masterData.dashboard.totalShipments,
        total_containers: masterData.dashboard.totalContainers,
        total_value: masterData.dashboard.totalValue,
        cleared_shipments: masterData.dashboard.clearedShipments,
        in_transit_shipments: masterData.dashboard.inTransitShipments,
        theoretical_tariff: masterData.dashboard.theoreticalTariff,
        actual_tariff: masterData.dashboard.actualTariff,
        tariff_savings: masterData.dashboard.tariffSavings,
        tariff_savings_rate: masterData.dashboard.tariffSavingsRate,
      }, { onConflict: "snapshot_date" })
    }

    // 2. Save Logistics Allocations (clear and re-insert)
    if (masterData?.logisticsAllocations?.length) {
      await supabase.from("logistics_cost_allocations").delete().neq("id", "00000000-0000-0000-0000-000000000000")
      
      // Get shipment IDs by BOL for foreign key
      const bolToShipment = new Map<string, string>()
      shipments?.forEach((s: Record<string, unknown>) => {
        if (s.bol && s.id) bolToShipment.set(s.bol as string, s.id as string)
      })

      const allocations = masterData.logisticsAllocations.map((a) => ({
        shipment_id: bolToShipment.get(a.bol) ?? null,
        sku: a.sku,
        quantity: a.quantity,
        weight_kg: a.weightKg,
        weight_share: a.weightShare,
        sea_freight: a.seaFreight,
        customs_fee: a.customsFee,
        domestic_freight: a.domesticFreight,
        total_freight: a.totalFreight,
        unit_freight: a.unitFreight,
      })).filter(a => a.shipment_id)

      if (allocations.length > 0) {
        await supabase.from("logistics_cost_allocations").insert(allocations)
      }
    }

    // 3. Save Tariff Allocations
    if (masterData?.tariffAllocations?.length) {
      await supabase.from("tariff_allocations").delete().neq("id", "00000000-0000-0000-0000-000000000000")
      
      const bolToShipment = new Map<string, string>()
      shipments?.forEach((s: Record<string, unknown>) => {
        if (s.bol && s.id) bolToShipment.set(s.bol as string, s.id as string)
      })

      const tariffs = masterData.tariffAllocations.map((t) => ({
        shipment_id: bolToShipment.get(t.bol) ?? null,
        sku: t.sku,
        quantity: t.quantity,
        hts_code: t.htsCode,
        theoretical_rate: t.theoreticalRate,
        actual_rate: t.actualRate,
        exw_value: t.exwValue,
        theoretical_tariff: t.theoreticalTariff,
        actual_tariff: t.actualTariff,
        unit_tariff: t.unitTariff,
        savings: t.savings,
      })).filter(t => t.shipment_id)

      if (tariffs.length > 0) {
        await supabase.from("tariff_allocations").insert(tariffs)
      }
    }

    // 4. Save Price Verifications
    if (masterData?.priceVerifications?.length) {
      await supabase.from("price_verifications").delete().neq("id", "00000000-0000-0000-0000-000000000000")
      
      const verifications = masterData.priceVerifications.map((p) => ({
        sku: p.sku,
        quantity: p.quantity,
        supplier_invoice_price: p.supplierInvoicePrice,
        supplier_quoted_price: p.supplierQuotedPrice ?? 0,
        supplier_variance: p.supplierVariance ?? 0,
        customer_total_price: p.customerTotalPrice ?? 0,
        margin_per_unit: p.marginPerUnit ?? 0,
        has_alert: p.hasAlert,
        alert_message: p.alertMessage,
      }))

      if (verifications.length > 0) {
        await supabase.from("price_verifications").insert(verifications)
      }
    }

    // 5. Save Profit Analysis
    if (masterData?.profitAnalysis?.length) {
      await supabase.from("profit_analysis").delete().neq("id", "00000000-0000-0000-0000-000000000000")
      
      const profits = masterData.profitAnalysis.map((p) => ({
        sku: p.sku,
        quantity: p.quantity,
        customer_quote_unit: p.customerQuoteUnit ?? 0,
        exw_cost: p.exwCost,
        freight_cost: p.freightCost,
        tariff_cost: p.tariffCost,
        total_cost_unit: p.totalCostUnit,
        gross_profit_unit: p.grossProfitUnit ?? 0,
        margin_percent: p.marginPercent ?? 0,
        is_provisional: p.isProvisional,
        status: p.status,
      }))

      if (profits.length > 0) {
        await supabase.from("profit_analysis").insert(profits)
      }
    }

    return NextResponse.json({
      success: true,
      data: masterData,
      summary: {
        orderManagementRows: orderManagement.length,
        logisticsAllocations: masterData?.logisticsAllocations?.length ?? 0,
        tariffAllocations: masterData?.tariffAllocations?.length ?? 0,
        priceVerifications: masterData?.priceVerifications?.length ?? 0,
        profitAnalysis: masterData?.profitAnalysis?.length ?? 0,
        alerts: masterData?.alerts?.length ?? 0,
      },
    })
  } catch (error) {
    console.error("Master generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate master table" },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch latest master data from database
export async function GET() {
  try {
    const supabase = await createClient()
    
    const [
      { data: dashboard },
      { data: logistics },
      { data: tariffs },
      { data: prices },
      { data: profits },
      { data: orderItems },
    ] = await Promise.all([
      supabase.from("master_dashboard_metrics").select("*").order("snapshot_date", { ascending: false }).limit(1).single(),
      supabase.from("logistics_cost_allocations").select("*"),
      supabase.from("tariff_allocations").select("*"),
      supabase.from("price_verifications").select("*"),
      supabase.from("profit_analysis").select("*"),
      supabase.from("container_items").select("*, containers(*, shipments(*))"),
    ])

    return NextResponse.json({
      success: true,
      data: {
        dashboard,
        logisticsAllocations: logistics ?? [],
        tariffAllocations: tariffs ?? [],
        priceVerifications: prices ?? [],
        profitAnalysis: profits ?? [],
        orderManagement: orderItems ?? [],
      },
    })
  } catch (error) {
    console.error("Master fetch error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch master data" },
      { status: 500 }
    )
  }
}
