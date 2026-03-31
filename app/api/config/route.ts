import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET all config data
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") // "tariffs", "customer_quotations", "supplier_quotations"
  
  try {
    const supabase = await createClient()
    
    if (type === "tariffs") {
      const { data, error } = await supabase
        .from("config_sku_tariffs")
        .select("*")
        .order("sku")
      if (error) throw error
      return NextResponse.json({ success: true, data })
    }
    
    if (type === "customer_quotations") {
      const { data, error } = await supabase
        .from("config_customer_quotations")
        .select("*")
        .order("customer, sku")
      if (error) throw error
      return NextResponse.json({ success: true, data })
    }
    
    if (type === "supplier_quotations") {
      const { data, error } = await supabase
        .from("config_supplier_quotations")
        .select("*")
        .order("supplier, sku")
      if (error) throw error
      return NextResponse.json({ success: true, data })
    }
    
    // Return all configs
    const [tariffs, customerQuotes, supplierQuotes] = await Promise.all([
      supabase.from("config_sku_tariffs").select("*").order("sku"),
      supabase.from("config_customer_quotations").select("*").order("customer, sku"),
      supabase.from("config_supplier_quotations").select("*").order("supplier, sku"),
    ])
    
    return NextResponse.json({
      success: true,
      data: {
        tariffs: tariffs.data ?? [],
        customerQuotations: customerQuotes.data ?? [],
        supplierQuotations: supplierQuotes.data ?? [],
      },
    })
  } catch (error) {
    console.error("Config fetch error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch config" },
      { status: 500 }
    )
  }
}

// POST to add/update config
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { type, data } = body
    
    if (type === "tariff") {
      const { sku, hts_code, theoretical_rate, actual_rate, description } = data
      const { data: result, error } = await supabase
        .from("config_sku_tariffs")
        .upsert({
          sku,
          hts_code,
          theoretical_rate: theoretical_rate ?? 0,
          actual_rate: actual_rate ?? 0,
          description,
          updated_at: new Date().toISOString(),
        }, { onConflict: "sku" })
        .select()
        .single()
      
      if (error) throw error
      return NextResponse.json({ success: true, data: result })
    }
    
    if (type === "customer_quotation") {
      const { customer, sku, quoted_price, effective_date, notes } = data
      const { data: result, error } = await supabase
        .from("config_customer_quotations")
        .upsert({
          customer,
          sku,
          quoted_price: quoted_price ?? 0,
          effective_date: effective_date ?? new Date().toISOString().split("T")[0],
          notes,
          updated_at: new Date().toISOString(),
        }, { onConflict: "customer,sku" })
        .select()
        .single()
      
      if (error) throw error
      return NextResponse.json({ success: true, data: result })
    }
    
    if (type === "supplier_quotation") {
      const { supplier, sku, quoted_price, effective_date, notes } = data
      const { data: result, error } = await supabase
        .from("config_supplier_quotations")
        .upsert({
          supplier,
          sku,
          quoted_price: quoted_price ?? 0,
          effective_date: effective_date ?? new Date().toISOString().split("T")[0],
          notes,
          updated_at: new Date().toISOString(),
        }, { onConflict: "supplier,sku" })
        .select()
        .single()
      
      if (error) throw error
      return NextResponse.json({ success: true, data: result })
    }
    
    // Batch import
    if (type === "batch_tariffs") {
      const items = data as Array<{
        sku: string
        hts_code?: string
        theoretical_rate?: number
        actual_rate?: number
        description?: string
      }>
      
      const { data: result, error } = await supabase
        .from("config_sku_tariffs")
        .upsert(
          items.map((item) => ({
            sku: item.sku,
            hts_code: item.hts_code ?? null,
            theoretical_rate: item.theoretical_rate ?? 0,
            actual_rate: item.actual_rate ?? 0,
            description: item.description ?? null,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "sku" }
        )
        .select()
      
      if (error) throw error
      return NextResponse.json({ success: true, data: result, count: items.length })
    }
    
    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  } catch (error) {
    console.error("Config save error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save config" },
      { status: 500 }
    )
  }
}

// DELETE config entry
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const id = searchParams.get("id")
    
    if (!type || !id) {
      return NextResponse.json({ error: "Missing type or id" }, { status: 400 })
    }
    
    const table = type === "tariff" 
      ? "config_sku_tariffs" 
      : type === "customer_quotation"
        ? "config_customer_quotations"
        : "config_supplier_quotations"
    
    const { error } = await supabase.from(table).delete().eq("id", id)
    
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Config delete error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete config" },
      { status: 500 }
    )
  }
}
