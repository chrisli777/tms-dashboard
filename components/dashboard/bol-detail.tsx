"use client"

import Link from "next/link"
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
import { ArrowLeft, Ship, Check } from "lucide-react"
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
  { label: "On Water", step: 1 },
  { label: "Customs Cleared", step: 2 },
  { label: "Delivering", step: 3 },
  { label: "Delivered", step: 4 },
  { label: "Closed", step: 5 },
]

function getCurrentStep(status: "Cleared" | "In Transit") {
  if (status === "In Transit") return 1
  return 2
}

export function BOLDetail({ summary }: BOLDetailProps) {
  const currentStep = getCurrentStep(summary.status)
  const totalItems = summary.containers.reduce(
    (sum, c) => sum + c.items.length,
    0
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-[1440px] px-6 py-5">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex size-9 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex flex-1 items-start justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-card-foreground">
                  {summary.invoice}
                </h1>
                <p className="font-mono text-sm text-muted-foreground">
                  {summary.bol}
                </p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="font-medium text-primary">
                  {summary.supplier}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {summary.containerCount} containers
                </span>
                <StatusBadge status={summary.status} />
                <span className="text-muted-foreground">
                  {formatDate(summary.etd)}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(summary.eta)}
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCurrency(summary.totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="flex flex-col gap-6">
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
                            step.step
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
                    <div className="flex items-center justify-between border-b px-5 py-3.5">
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
                      <span className="text-xs text-muted-foreground">
                        {ctr.items.length} {ctr.items.length === 1 ? "SKU" : "SKUs"}
                      </span>
                    </div>
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
                          <TableRow key={`${item.sku}-${item.whiPo}-${idx}`}>
                            <TableCell className="font-medium text-foreground">
                              {item.sku}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.whiPo}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {item.qty.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatCurrency(item.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums text-foreground">
                              {formatCurrency(item.amount)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {item.gw.toLocaleString()} lbs
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
      </main>
    </div>
  )
}

function StatusBadge({ status }: { status: "Cleared" | "In Transit" }) {
  if (status === "Cleared") {
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
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-chart-3/10 px-2.5 py-1 text-xs font-medium text-chart-3">
      <Ship className="size-3.5" />
      In Transit
    </span>
  )
}
