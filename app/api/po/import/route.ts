import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ParsedOrderManagement, ParsedLineItem } from "../parse/route"

export async function POST(request: Request) {
  try {
    const { parsedData }: { parsedData: ParsedOrderManagement } = await request.json()
    const supabase = createAdminClient()

    // Group line items by WHI PO (since one file can have multiple POs)
    const itemsByPO = new Map<string, ParsedLineItem[]>()
    for (const item of parsedData.lineItems) {
      const poKey = item.whiPo
      if (!itemsByPO.has(poKey)) {
        itemsByPO.set(poKey, [])
      }
      itemsByPO.get(poKey)!.push(item)
    }

    const results: Array<{
      poNumber: string
      action: string
      orderId?: string
      shipmentId?: string
      message: string
    }> = []

    const hasBOL = parsedData.bolNumber !== null && parsedData.bolNumber !== ""

    // Process each PO
    for (const [poNumber, items] of itemsByPO) {
      // Check if PO already exists
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, status")
        .eq("po_number", poNumber)
        .single()

      // Get first item for metadata
      const firstItem = items[0]
      const supplier = firstItem.supplier
      const customer = firstItem.customer
      const etd = firstItem.etd || parsedData.etd
      const eta = firstItem.eta || parsedData.eta

      // Calculate totals for this PO
      const totalQty = items.reduce((sum, item) => sum + item.qty, 0)
      const totalAmount = items.reduce((sum, item) => sum + item.amountUsd, 0)
      const totalWeight = items.reduce((sum, item) => sum + (item.gwKg || 0), 0)

      if (existingOrder) {
        // Update existing order
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            supplier: supplier,
            customer: customer,
            due_date: etd, // Use ETD as due date
          })
          .eq("id", existingOrder.id)

        if (updateError) {
          results.push({
            poNumber,
            action: "error",
            message: `Failed to update: ${updateError.message}`,
          })
          continue
        }

        // If status is Pending and we now have BOL, upgrade to In Progress
        if (existingOrder.status === "Pending" && hasBOL) {
          await supabase
            .from("orders")
            .update({ status: "In Progress" })
            .eq("id", existingOrder.id)

          // Convert pending_items to actual shipment/containers
          await convertPendingToShipment(supabase, existingOrder.id, parsedData, items)
        } else if (existingOrder.status === "Pending") {
          // Update pending items
          await supabase
            .from("pending_items")
            .delete()
            .eq("order_id", existingOrder.id)

          const pendingItems = items.map((item) => ({
            order_id: existingOrder.id,
            sku: item.sku,
            description: null,
            qty_ordered: item.qty,
            qty_received: 0,
            unit_cost: item.unitPriceUsd,
            amount: item.amountUsd,
            weight: item.gwKg || 0,
          }))

          await supabase.from("pending_items").insert(pendingItems)
        }

        results.push({
          poNumber,
          action: "updated",
          orderId: existingOrder.id,
          message: `Updated PO ${poNumber}`,
        })
      } else {
        // Create new order
        const status = hasBOL ? "In Progress" : "Pending"

        const { data: newOrder, error: createError } = await supabase
          .from("orders")
          .insert({
            po_number: poNumber,
            supplier: supplier,
            customer: customer,
            order_date: new Date().toISOString().split("T")[0],
            status,
            due_date: etd,
          })
          .select("id")
          .single()

        if (createError || !newOrder) {
          results.push({
            poNumber,
            action: "error",
            message: `Failed to create: ${createError?.message}`,
          })
          continue
        }

        if (hasBOL) {
          // Create shipment with full details
          const shipmentResult = await createShipmentWithContainers(
            supabase,
            newOrder.id,
            parsedData,
            items
          )

          results.push({
            poNumber,
            action: "created_with_bol",
            orderId: newOrder.id,
            shipmentId: shipmentResult.shipmentId,
            message: `Created PO ${poNumber} with BOL ${parsedData.bolNumber}`,
          })
        } else {
          // Create as pending with pending_items
          const pendingItems = items.map((item) => ({
            order_id: newOrder.id,
            sku: item.sku,
            description: null,
            qty_ordered: item.qty,
            qty_received: 0,
            unit_cost: item.unitPriceUsd,
            amount: item.amountUsd,
            weight: item.gwKg || 0,
          }))

          await supabase.from("pending_items").insert(pendingItems)

          results.push({
            poNumber,
            action: "created_pending",
            orderId: newOrder.id,
            message: `Created pending PO ${poNumber}`,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalPOs: results.length,
        created: results.filter((r) => r.action.startsWith("created")).length,
        updated: results.filter((r) => r.action === "updated").length,
        errors: results.filter((r) => r.action === "error").length,
      },
    })
  } catch (error) {
    console.error("PO import error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import PO" },
      { status: 500 }
    )
  }
}

// Helper to create shipment with containers and items
async function createShipmentWithContainers(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
  parsedData: ParsedOrderManagement,
  items: ParsedLineItem[]
) {
  // Create shipment
  const { data: shipment, error: shipmentError } = await supabase
    .from("shipments")
    .insert({
      invoice: parsedData.invoiceNumber,
      bol: parsedData.bolNumber,
      supplier: parsedData.supplierDetected,
      etd: parsedData.etd,
      eta: parsedData.eta,
      status: "On Water",
    })
    .select("id")
    .single()

  if (shipmentError || !shipment) {
    throw new Error(`Failed to create shipment: ${shipmentError?.message}`)
  }

  // Create containers from parsed container list
  const containerMap = new Map<string, string>() // container number -> container id
  
  if (parsedData.containers.length > 0) {
    for (const cont of parsedData.containers) {
      const { data: container, error: containerError } = await supabase
        .from("containers")
        .insert({
          container: cont.number,
          shipment_id: shipment.id,
          size: cont.type,
          seal_no: cont.sealNo,
          status: "On Water",
        })
        .select("id")
        .single()

      if (container) {
        containerMap.set(cont.number, container.id)
      }
    }
  } else {
    // Create a default container if none specified
    const { data: container } = await supabase
      .from("containers")
      .insert({
        container: `CONT-${parsedData.invoiceNumber}`,
        shipment_id: shipment.id,
        size: "40HQ",
        status: "On Water",
      })
      .select("id")
      .single()

    if (container) {
      containerMap.set("default", container.id)
    }
  }

  // Insert container items
  const containerItems = items.map((item) => {
    // Find container ID for this item
    let containerId = containerMap.get(item.container || "") || 
                     Array.from(containerMap.values())[0]

    return {
      sku: item.sku,
      description: null,
      qty: item.qty,
      gw_kg: item.gwKg || 0,
      amount_usd: item.amountUsd,
      whi_po: item.whiPo,
      order_id: orderId,
      container_id: containerId,
    }
  })

  await supabase.from("container_items").insert(containerItems)

  return { shipmentId: shipment.id }
}

// Helper to convert pending order to shipment when BOL arrives
async function convertPendingToShipment(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
  parsedData: ParsedOrderManagement,
  items: ParsedLineItem[]
) {
  // Delete pending items
  await supabase.from("pending_items").delete().eq("order_id", orderId)

  // Create shipment with containers
  await createShipmentWithContainers(supabase, orderId, parsedData, items)
}
