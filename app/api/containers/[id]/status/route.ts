import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  try {
    const { status } = await request.json()

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      )
    }

    // Container can be "Customs Cleared", "Scheduled", or "Delivered"
    if (!["Customs Cleared", "Scheduled", "Delivered"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid container status. Must be 'Customs Cleared', 'Scheduled', or 'Delivered'" },
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
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      )
    }

    // Update container status
    const { error: updateError } = await supabase
      .from("containers")
      .update({ status })
      .eq("id", id)

    if (updateError) {
      console.error("Failed to update container:", updateError)
      return NextResponse.json(
        { error: "Failed to update container status" },
        { status: 500 }
      )
    }

    // Get all containers for this shipment to determine shipment status
    const { data: allContainers, error: containersError } = await supabase
      .from("containers")
      .select("status")
      .eq("shipment_id", container.shipment_id)

    if (containersError) {
      console.error("Failed to fetch containers:", containersError)
      return NextResponse.json({ success: true })
    }

    // Determine new shipment status based on container statuses
    const containerStatuses = allContainers.map((c) => c.status)
    let newShipmentStatus: string | null = null

    if (containerStatuses.every((s) => s === "Delivered")) {
      newShipmentStatus = "Delivered"
    } else if (containerStatuses.some((s) => s === "Scheduled" || s === "Delivered")) {
      newShipmentStatus = "Delivering"
    }

    // Update shipment status if needed
    if (newShipmentStatus) {
      const { error: shipmentError } = await supabase
        .from("shipments")
        .update({ status: newShipmentStatus })
        .eq("id", container.shipment_id)

      if (shipmentError) {
        console.error("Failed to update shipment status:", shipmentError)
      }
    }

    return NextResponse.json({ success: true, shipmentStatus: newShipmentStatus })
  } catch (error) {
    console.error("Error updating container status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
