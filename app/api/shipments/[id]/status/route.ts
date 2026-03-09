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

    console.log("[v0] Updating shipment status:", { id, status })

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      )
    }

    // Valid shipment statuses (Delivering renamed to Scheduled)
    const validStatuses = ["Booked", "On Water", "Customs Cleared", "Scheduled", "Delivered", "Closed"]
    if (!validStatuses.includes(status)) {
      console.log("[v0] Invalid status:", status)
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      )
    }

    // Update shipment status
    const { data: shipmentData, error: shipmentError } = await supabase
      .from("shipments")
      .update({ status })
      .eq("id", id)
      .select()

    if (shipmentError) {
      console.error("[v0] Failed to update shipment:", shipmentError)
      return NextResponse.json(
        { error: "Failed to update shipment status" },
        { status: 500 }
      )
    }

    console.log("[v0] Shipment updated:", shipmentData)

    // Map shipment status to container status - sync all containers
    // When BOL status changes, all its containers should match
    let containerStatus: string = status
    // Container statuses: Booked, On Water, Customs Cleared, Scheduled, Delivered
    // Map Closed to Delivered for containers
    if (status === "Closed") {
      containerStatus = "Delivered"
    }

    // Update all containers for this shipment
    const { data: containerData, error: containerError } = await supabase
      .from("containers")
      .update({ status: containerStatus })
      .eq("shipment_id", id)
      .select()

    if (containerError) {
      console.error("[v0] Failed to update containers:", containerError)
    } else {
      console.log("[v0] Containers updated:", containerData?.length)
    }

    return NextResponse.json({ success: true, shipment: shipmentData, containers: containerData })
  } catch (error) {
    console.error("[v0] Error updating shipment status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
