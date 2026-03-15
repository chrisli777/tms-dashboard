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

    console.log("[v0] Updating order status:", { id, status })

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      )
    }

    // Update order status
    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()

    if (error) {
      console.error("[v0] Failed to update order:", error)
      return NextResponse.json(
        { error: "Failed to update order status", details: error.message },
        { status: 500 }
      )
    }

    console.log("[v0] Order updated:", data)
    return NextResponse.json({ success: true, order: data })
  } catch (error) {
    console.error("[v0] Error updating order status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
