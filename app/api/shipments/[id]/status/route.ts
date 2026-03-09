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
    const containerStatus = status === "Customs Cleared" ? "Customs Cleared" : "On Water"

    // Update all containers in this shipment
    const { error: containerError } = await supabase
      .from("containers")
      .update({ status: containerStatus })
      .eq("shipment_id", id)

    if (containerError) {
      console.error("Failed to update containers:", containerError)
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
