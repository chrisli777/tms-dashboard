import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

interface WmsRef {
  referenceNum: string
  arrivalDate: string
}

/**
 * Reconcile Scheduled containers against WMS receiver data.
 *
 * For every container currently in the "Scheduled" dispatch stage (within the
 * given date range), we try to match its container_number against a WMS
 * reference number. On a match, the container is automatically advanced to the
 * "Closed" stage and its close_date is recorded as the WMS arrival date.
 *
 * Body: {
 *   startDate: string, endDate: string,   // range for scheduled containers
 *   references: { referenceNum, arrivalDate }[]   // from the WMS export
 * }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      startDate?: string
      endDate?: string
      references?: WmsRef[]
    }

    const { startDate, endDate } = body
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 },
      )
    }

    const references = body.references ?? []

    // Build a lookup of normalized reference number -> earliest arrival date.
    // WMS reference numbers are matched against container numbers (case- and
    // whitespace-insensitive) per the business rule.
    const refMap = new Map<string, string>()
    for (const ref of references) {
      const key = normalize(ref.referenceNum)
      if (!key) continue
      const existing = refMap.get(key)
      if (!existing || (ref.arrivalDate && ref.arrivalDate < existing)) {
        refMap.set(key, ref.arrivalDate || existing || "")
      }
    }

    const supabase = createAdminClient()

    // Include the whole endDate day.
    const endExclusive = new Date(endDate + "T00:00:00Z")
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)

    const { data: scheduled, error: schedErr } = await supabase
      .from("shipment_containers")
      .select("id, container_number, dispatch_status_changed_at")
      .eq("tenant_id", "whi")
      .eq("dispatch_status", "SCHEDULED")
      .gte("dispatch_status_changed_at", startDate + "T00:00:00Z")
      .lt("dispatch_status_changed_at", endExclusive.toISOString())

    if (schedErr) {
      console.error("[v0] reconcile query error:", schedErr.message)
      return NextResponse.json({ error: schedErr.message }, { status: 500 })
    }

    const matched: { container: string; closeDate: string | null }[] = []
    const unmatched: string[] = []

    for (const row of scheduled ?? []) {
      const container = row.container_number as string
      const arrivalDate = refMap.get(normalize(container))
      if (arrivalDate !== undefined) {
        // Normalize the WMS arrival date (may be an ISO timestamp) to a date.
        const closeDate = toDateOnly(arrivalDate)
        const { error: updErr } = await supabase
          .from("shipment_containers")
          .update({
            dispatch_status: "CLOSED",
            close_date: closeDate,
            dispatch_status_changed_at: new Date().toISOString(),
          })
          .eq("id", row.id)

        if (updErr) {
          console.error(`[v0] reconcile update error for ${container}:`, updErr.message)
          continue
        }
        matched.push({ container, closeDate })
      } else {
        unmatched.push(container)
      }
    }

    return NextResponse.json({
      success: true,
      scheduledCount: scheduled?.length ?? 0,
      matchedCount: matched.length,
      matched,
      unmatched,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reconcile"
    console.error("[v0] reconcile error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().toUpperCase().replace(/\s+/g, "")
}

/** Reduce an ISO timestamp or date string to YYYY-MM-DD (or null). */
function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.match(/^\d{4}-\d{2}-\d{2}/)
  if (match) return match[0]
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}
