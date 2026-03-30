import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ParsedPO } from "../parse/route"

export async function POST(request: Request) {
  try {
    const { parsedData }: { parsedData: ParsedPO } = await request.json()
    const supabase = createAdminClient()

    // Check if PO already exists
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("po_number", parsedData.poNumber)
      .single()

    const hasBOL = parsedData.bolNumber !== null && parsedData.bolNumber !== ""

    if (existingOrder) {
      // Update existing order
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          supplier: parsedData.supplier,
          customer: parsedData.customer || "WHI",
          order_date: parsedData.orderDate,
          due_date: parsedData.dueDate,
        })
        .eq("id", existingOrder.id)

      if (updateError) {
        throw new Error(`Failed to update order: ${updateError.message}`)
      }

      // Update pending items if order is still pending
      if (!hasBOL) {
        // Delete existing pending items
        await supabase
          .from("pending_items")
          .delete()
          .eq("order_id", existingOrder.id)

        // Insert new pending items
        if (parsedData.items.length > 0) {
          const pendingItems = parsedData.items.map((item) => ({
            order_id: existingOrder.id,
            sku: item.sku,
            description: item.description,
            qty_ordered: item.qty,
            qty_received: 0,
            unit_cost: item.unitCost,
            amount: item.amount,
            weight: item.weight || 0,
          }))

          const { error: itemsError } = await supabase
            .from("pending_items")
            .insert(pendingItems)

          if (itemsError) {
            throw new Error(`Failed to insert pending items: ${itemsError.message}`)
          }
        }
      }

      return NextResponse.json({
        success: true,
        action: "updated",
        orderId: existingOrder.id,
        message: `Updated PO ${parsedData.poNumber}`,
      })
    }

    // Create new order
    const status = hasBOL ? "In Progress" : "Pending"

    const { data: newOrder, error: createError } = await supabase
      .from("orders")
      .insert({
        po_number: parsedData.poNumber,
        supplier: parsedData.supplier,
        customer: parsedData.customer || "WHI",
        order_date: parsedData.orderDate || new Date().toISOString().split("T")[0],
        status,
        due_date: parsedData.dueDate,
      })
      .select("id")
      .single()

    if (createError || !newOrder) {
      throw new Error(`Failed to create order: ${createError?.message}`)
    }

    if (hasBOL) {
      // Create shipment, containers, and items for POs with BOL
      const { data: shipment, error: shipmentError } = await supabase
        .from("shipments")
        .insert({
          invoice: `INV-${parsedData.poNumber}`,
          bol: parsedData.bolNumber,
          supplier: parsedData.supplier,
          etd: parsedData.etd,
          eta: parsedData.eta,
          status: "On Water",
        })
        .select("id")
        .single()

      if (shipmentError || !shipment) {
        throw new Error(`Failed to create shipment: ${shipmentError?.message}`)
      }

      // Create containers
      const containerNumbers = parsedData.containerNumbers || [`CONT-${parsedData.poNumber}`]
      const containersToInsert = containerNumbers.map((containerNum, index) => ({
        container: containerNum,
        shipment_id: shipment.id,
        size: "40HQ",
        status: "On Water",
      }))

      const { data: containers, error: containersError } = await supabase
        .from("containers")
        .insert(containersToInsert)
        .select("id")

      if (containersError || !containers) {
        throw new Error(`Failed to create containers: ${containersError?.message}`)
      }

      // Distribute items across containers
      const itemsPerContainer = Math.ceil(parsedData.items.length / containers.length)
      const containerItems = parsedData.items.map((item, index) => ({
        sku: item.sku,
        description: item.description,
        qty: item.qty,
        gw_kg: item.weight || 0,
        amount_usd: item.amount,
        whi_po: parsedData.poNumber,
        order_id: newOrder.id,
        container_id: containers[Math.floor(index / itemsPerContainer)]?.id || containers[0].id,
      }))

      const { error: itemsError } = await supabase
        .from("container_items")
        .insert(containerItems)

      if (itemsError) {
        throw new Error(`Failed to create container items: ${itemsError?.message}`)
      }

      return NextResponse.json({
        success: true,
        action: "created_with_bol",
        orderId: newOrder.id,
        shipmentId: shipment.id,
        message: `Created PO ${parsedData.poNumber} with BOL ${parsedData.bolNumber}`,
      })
    } else {
      // Create pending items for POs without BOL
      if (parsedData.items.length > 0) {
        const pendingItems = parsedData.items.map((item) => ({
          order_id: newOrder.id,
          sku: item.sku,
          description: item.description,
          qty_ordered: item.qty,
          qty_received: 0,
          unit_cost: item.unitCost,
          amount: item.amount,
          weight: item.weight || 0,
        }))

        const { error: itemsError } = await supabase
          .from("pending_items")
          .insert(pendingItems)

        if (itemsError) {
          throw new Error(`Failed to insert pending items: ${itemsError.message}`)
        }
      }

      return NextResponse.json({
        success: true,
        action: "created_pending",
        orderId: newOrder.id,
        message: `Created pending PO ${parsedData.poNumber}`,
      })
    }
  } catch (error) {
    console.error("PO import error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import PO" },
      { status: 500 }
    )
  }
}
