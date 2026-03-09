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

    // Valid shipment statuses
    const validStatuses = ["Booked", "On Water", "Customs Cleared", "Delivering", "Delivered", "Closed"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      )
    }

    // Update shipment status
    const { error: shipmentError } = await supabase
      .from("shipments")
      .update({ status })
      .eq("id", id)

    if (shipmentError) {
      console.error("Failed to update shipment:", shipmentError)
      return NextResponse.json(
        { error: "Failed to update shipment status" },
        { status: 500 }
      )
    }

    // Map shipment status to container status
    // Container status is separate - only changes if explicitly set
    // But we can set initial container status based on shipment status
    let containerStatus: string | null = null
    if (status === "Customs Cleared") {
      containerStatus = "Customs Cleared"
    } else if (status === "Delivering") {
      containerStatus = "Scheduled"
    } else if (status === "Delivered" || status === "Closed") {
      containerStatus = "Delivered"
    } else if (status === "Booked" || status === "On Water") {
      containerStatus = status
    }

    // Only update container status if needed
    if (containerStatus) {
      const { error: containerError } = await supabase
        .from("containers")
        .update({ status: containerStatus })
        .eq("shipment_id", id)

      if (containerError) {
        console.error("Failed to update containers:", containerError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating shipment status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
