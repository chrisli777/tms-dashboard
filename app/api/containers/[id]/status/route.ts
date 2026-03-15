import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // Use admin client to bypass RLS
  const supabase = createAdminClient()

  try {
    const { status } = await request.json()

    console.log("[v0] Updating container status:", { id, status })

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      )
    }

    // Valid container statuses (same as BOL but uses "Scheduled" instead of "Delivering")
    const validStatuses = ["Booked", "On Water", "Customs Cleared", "Scheduled", "Delivered"]
    if (!validStatuses.includes(status)) {
      console.log("[v0] Invalid container status:", status)
      return NextResponse.json(
        { error: "Invalid container status" },
        { status: 400 }
      )
    }

    // Get container to find shipment_id
    const { data: container, error: fetchError } = await supabase
      .from("containers")
      .select("shipment_id")
      .eq("id", id)
      .single()

    if (fetchError || !container) {
      console.error("[v0] Container not found:", fetchError)
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      )
    }

    // Update container status
    const { data: updatedContainer, error: updateError } = await supabase
      .from("containers")
      .update({ status })
      .eq("id", id)
      .select()

    if (updateError) {
      console.error("[v0] Failed to update container:", updateError)
      return NextResponse.json(
        { error: "Failed to update container status", details: updateError.message },
        { status: 500 }
      )
    }

    console.log("[v0] Container updated:", updatedContainer)

    // Get all containers for this shipment to determine shipment status
    const { data: allContainers, error: containersError } = await supabase
      .from("containers")
      .select("status")
      .eq("shipment_id", container.shipment_id)

    if (containersError) {
      console.error("[v0] Failed to fetch containers:", containersError)
      return NextResponse.json({ success: true, container: updatedContainer })
    }

    // Determine new shipment/BOL status based on container statuses
    // Logic:
    // - If ALL containers are Scheduled -> BOL is "Delivering"
    // - If ALL containers are Delivered -> BOL is "Delivered"
    // - Otherwise, don't auto-update BOL status (mixed states from Customs Cleared onwards)
    const containerStatuses = allContainers.map((c) => c.status)
    let newShipmentStatus: string | null = null

    if (containerStatuses.every((s) => s === "Delivered")) {
      newShipmentStatus = "Delivered"
    } else if (containerStatuses.every((s) => s === "Scheduled")) {
      newShipmentStatus = "Delivering"
    }

    // Update shipment status if needed
    if (newShipmentStatus) {
      const { data: shipmentData, error: shipmentError } = await supabase
        .from("shipments")
        .update({ status: newShipmentStatus })
        .eq("id", container.shipment_id)
        .select()

      if (shipmentError) {
        console.error("[v0] Failed to update shipment status:", shipmentError)
      } else {
        console.log("[v0] Shipment status updated to:", newShipmentStatus, shipmentData)
      }
    }

    return NextResponse.json({ 
      success: true, 
      container: updatedContainer,
      shipmentStatus: newShipmentStatus 
    })
  } catch (error) {
    console.error("[v0] Error updating container status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
