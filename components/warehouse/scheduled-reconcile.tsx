"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CalendarCheck, CheckCircle2, Loader2, PackageCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/ui/status-badge"

interface ScheduledContainer {
  container: string
  poNumber: string
  sku: string
  quantity: number
  scheduledAt: string | null
  ata: string | null
}

interface WmsRef {
  referenceNum: string
  arrivalDate: string
}

interface ReconcileResult {
  matched: { container: string; closeDate: string | null }[]
  unmatched: string[]
  matchedCount: number
  scheduledCount: number
}

interface ScheduledReconcileProps {
  startDate: string
  endDate: string
  /** WMS references from the most recent Fetch Data, used to auto-match. */
  references: WmsRef[]
  /** Increments on every Fetch Data click so we know to re-run reconciliation. */
  fetchToken: number
}

export function ScheduledReconcile({
  startDate,
  endDate,
  references,
  fetchToken,
}: ScheduledReconcileProps) {
  const [scheduled, setScheduled] = useState<ScheduledContainer[]>([])
  const [loading, setLoading] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [result, setResult] = useState<ReconcileResult | null>(null)
  const lastToken = useRef(0)

  const loadScheduled = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/warehouse/scheduled?startDate=${startDate}&endDate=${endDate}`,
      )
      const json = await res.json()
      setScheduled(json.containers ?? [])
    } catch (err) {
      console.error("[v0] load scheduled error:", err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  // Load scheduled containers whenever the date range changes.
  useEffect(() => {
    loadScheduled()
    setResult(null)
  }, [loadScheduled])

  // When Fetch Data runs, auto-match the scheduled containers against the WMS
  // references and close the matches.
  useEffect(() => {
    if (fetchToken === 0 || fetchToken === lastToken.current) return
    lastToken.current = fetchToken

    const reconcile = async () => {
      setReconciling(true)
      try {
        const res = await fetch("/api/warehouse/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate, endDate, references }),
        })
        const json = (await res.json()) as ReconcileResult & { error?: string }
        if (res.ok) {
          setResult(json)
          await loadScheduled()
        } else {
          console.error("[v0] reconcile failed:", json.error)
        }
      } catch (err) {
        console.error("[v0] reconcile error:", err)
      } finally {
        setReconciling(false)
      }
    }

    reconcile()
  }, [fetchToken, references, startDate, endDate, loadScheduled])

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Scheduled Containers</CardTitle>
        </div>
        <CardDescription>
          Containers marked Scheduled in the selected range. Fetching WMS data automatically
          matches them by container number and closes any that have arrived.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reconciliation result banner */}
        {reconciling && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Matching scheduled containers against WMS arrivals...
          </div>
        )}
        {result && !reconciling && (
          <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                {result.matchedCount} of {result.scheduledCount} scheduled containers matched and
                closed.
              </p>
              {result.matched.length > 0 && (
                <p className="mt-1 text-emerald-700">
                  Closed: {result.matched.map((m) => `${m.container} (${m.closeDate})`).join(", ")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Scheduled containers table */}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Container #</TableHead>
                <TableHead>PO #</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Scheduled On</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : scheduled.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    <PackageCheck className="mx-auto mb-2 h-6 w-6" />
                    No scheduled containers in this date range
                  </TableCell>
                </TableRow>
              ) : (
                scheduled.map((c) => (
                  <TableRow key={c.container}>
                    <TableCell className="font-mono font-medium">{c.container}</TableCell>
                    <TableCell className="font-mono text-sm">{c.poNumber || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{c.sku || "-"}</TableCell>
                    <TableCell className="text-right">{c.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(c.scheduledAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status="Scheduled" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
