import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface MasterRow {
  whiPo: string
  supplierInvoice: string
  supplier: string
  customer: string
  containerNo: string
  containerType: string
  blNo: string
  vessel: string
  sku: string
  description: string
  qty: number
  unitPrice: number
  amount: number
  etd: string
  eta: string
}

export async function POST(request: Request) {
  try {
    const { rows } = (await request.json()) as { rows: MasterRow[] }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 })
    }

    const supabase = await createClient()

    // Insert rows into master_orders table
    const { data, error } = await supabase
      .from("master_orders")
      .upsert(
        rows.map((row) => ({
          whi_po: row.whiPo,
          supplier_invoice: row.supplierInvoice,
          supplier: row.supplier,
          customer: row.customer,
          container_no: row.containerNo,
          container_type: row.containerType,
          bl_no: row.blNo,
          vessel: row.vessel,
          sku: row.sku,
          description: row.description,
          qty: row.qty,
          unit_price: row.unitPrice,
          amount: row.amount,
          etd: row.etd || null,
          eta: row.eta || null,
          updated_at: new Date().toISOString(),
        })),
        {
          onConflict: "whi_po,supplier_invoice,container_no,sku",
          ignoreDuplicates: false,
        }
      )
      .select()

    if (error) {
      console.error("[v0] Supabase insert error:", error)
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      inserted: data?.length || rows.length,
    })
  } catch (err) {
    console.error("[v0] Confirm error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save" },
      { status: 500 }
    )
  }
}
