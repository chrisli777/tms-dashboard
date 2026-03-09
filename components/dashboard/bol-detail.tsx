"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Ship, Check, ChevronRight } from "lucide-react"
import { StatusSelector, SHIPMENT_STATUSES } from "@/components/ui/status-selector"
import type { BOLSummary } from "@/lib/bol-data"

interface BOLDetailProps {
  summary: BOLSummary
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const TIMELINE_STEPS = [
  { label: "Booked", step: 0 },
  { label: "On Water", step: 1 },
  { label: "Customs Cleared", step: 2 },
  { label: "Delivering", step: 3 },
  { label: "Delivered", step: 4 },
  { label: "Closed", step: 5 },
]

function getCurrentStep(status: string) {
  const stepMap: Record<string, number> = {
    "Booked": 0,
    "On Water": 1,
    "Customs Cleared": 2,
    "Delivering": 3,
    "Delivered": 4,
    "Closed": 5,
  }
  return stepMap[status] ?? 1
}

export function BOLDetail({ summary }: BOLDetailProps) {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const currentStep = getCurrentStep(summary.status)
  const totalItems = summary.containers.reduce(
    (sum, c) => sum + c.items.length,
    0
  )

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/shipments/${summary.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update status")
      }

      // Revalidate all related data
      mutate(() => true, undefined, { revalidate: true })
      router.refresh()
    } catch (error) {
      console.error("Error updating status:", error)
      alert("Failed to update status. Please try again.")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Info bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium text-primary">
            {summary.supplier}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {summary.containerCount} containers
          </span>
          <span className="text-muted-foreground">
            ETD: {formatDate(summary.etd)}
          </span>
          <span className="text-muted-foreground">
            ETA: {formatDate(summary.eta)}
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatCurrency(summary.totalAmount)}
          </span>
        </div>
        <StatusSelector
          currentStatus={summary.status}
          statuses={SHIPMENT_STATUSES}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Status Timeline */}
      <Card>
        <CardContent className="px-6 py-5">
          <h2 className="mb-5 text-xs font-semibold tracking-wider text-muted-foreground">
            STATUS TIMELINE
          </h2>
          <div className="flex items-center">
            {TIMELINE_STEPS.map((step, idx) => {
              const isCompleted = step.step <= currentStep
              const isActive = step.step === currentStep
              const isLast = idx === TIMELINE_STEPS.length - 1

              return (
                <div
                  key={step.label}
                  className={`flex items-center ${isLast ? "" : "flex-1"}`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                        isCompleted
                          ? isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-success text-success-foreground"
                          : "border-2 border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {isCompleted && !isActive ? (
                        <Check className="size-4" />
                      ) : (
                        step.step + 1
                      )}
                    </div>
                    <span
                      className={`whitespace-nowrap text-xs font-medium ${
                        isCompleted
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className={`mx-2 mt-[-18px] h-0.5 flex-1 rounded-full ${
                        step.step < currentStep
                          ? "bg-success"
                          : "bg-border"
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Container Status + Tracking Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="px-6 py-5">
            <h2 className="mb-4 text-xs font-semibold tracking-wider text-muted-foreground">
              CONTAINER STATUS ({summary.containerCount} CONTAINERS)
            </h2>
            <div className="flex items-center gap-3">
              <StatusBadge status={summary.status} />
              <span className="text-sm font-medium text-foreground">
                {summary.containerCount}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-6 py-5">
            <h2 className="mb-4 text-xs font-semibold tracking-wider text-muted-foreground">
              SHIPMENT SUMMARY
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">
                  ETD
                </p>
                <p className="text-sm font-medium text-foreground">
                  {formatDate(summary.etd)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">
                  ETA
                </p>
                <p className="text-sm font-medium text-foreground">
                  {formatDate(summary.eta)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">
                  TOTAL VALUE
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(summary.totalAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Containers & SKUs */}
      <div>
        <h2 className="mb-4 text-xs font-semibold tracking-wider text-muted-foreground">
          CONTAINERS & SKUS ({totalItems} ITEMS)
        </h2>
        <div className="flex flex-col gap-4">
          {summary.containers.map((ctr) => (
            <Card key={ctr.container}>
              <CardContent className="p-0">
                {/* Container header */}
                <Link
                  href={`/container/${ctr.id}`}
                  className="flex items-center justify-between border-b px-5 py-3.5 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {ctr.container}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs font-normal text-muted-foreground"
                    >
                      {ctr.type}
                    </Badge>
                    <StatusBadge status={ctr.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {ctr.items.length} {ctr.items.length === 1 ? "SKU" : "SKUs"}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
                {/* Items table */}
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>SKU</TableHead>
                      <TableHead>PO</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">
                        Unit Price
                      </TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ctr.items.map((item, idx) => (
                      <TableRow key={`${item.sku}-${item.whi_po}-${idx}`}>
                        <TableCell className="font-medium text-foreground">
                          {item.sku}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.whi_po}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.qty.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCurrency(item.unit_price_usd)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-foreground">
                          {formatCurrency(item.amount_usd)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {item.gw_kg.toLocaleString()} lbs
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Customs Cleared" || status === "Cleared") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        <svg
          className="size-3.5"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            width="16"
            height="16"
            rx="3"
            fill="currentColor"
            fillOpacity="0.15"
          />
          <path
            d="M11.5 5.5L7 10.5L4.5 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Customs Cleared
      </span>
    )
  }
  if (status === "Delivered" || status === "Closed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        <Check className="size-3.5" />
        {status}
      </span>
    )
  }
  if (status === "Booked") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        Booked
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-chart-3/10 px-2.5 py-1 text-xs font-medium text-chart-3">
      <Ship className="size-3.5" />
      {status === "In Transit" ? "In Transit" : status}
    </span>
  )
}
