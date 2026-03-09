"use client"

import Link from "next/link"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { OrderSummary } from "@/lib/order-data"

interface OrderDetailProps {
  order: OrderSummary
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

function formatWeight(value: number) {
  return `${value.toLocaleString()} lbs`
}

export function OrderDetail({ order }: OrderDetailProps) {
  const clearedBOLs = order.bols.filter((b) => b.status === "Cleared").length
  const inTransitBOLs = order.bols.filter((b) => b.status === "In Transit").length

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Back button and header */}
        <div className="mb-6">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Orders
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                PO-{order.poNumber}
              </h1>
              <p className="text-sm text-muted-foreground">
                {order.supplier} • {order.customer} • Order Date: {formatDate(order.orderDate)}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          <Card className="border-primary/20 bg-primary/5 py-4">
            <CardContent className="px-4">
              <div className="text-2xl font-bold tabular-nums text-primary">
                {order.bolCount}
              </div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                TOTAL BOLS
              </p>
            </CardContent>
          </Card>
          <Card className="border-success/20 bg-success/5 py-4">
            <CardContent className="px-4">
              <div className="text-2xl font-bold tabular-nums text-success">
                {clearedBOLs}
              </div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                CLEARED
              </p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20 bg-amber-500/5 py-4">
            <CardContent className="px-4">
              <div className="text-2xl font-bold tabular-nums text-amber-600">
                {inTransitBOLs}
              </div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                IN TRANSIT
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5 py-4">
            <CardContent className="px-4">
              <div className="text-2xl font-bold tabular-nums text-primary">
                {order.containerCount}
              </div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                CONTAINERS
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5 py-4">
            <CardContent className="px-4">
              <div className="text-2xl font-bold tabular-nums text-primary">
                {formatCurrency(order.totalAmount)}
              </div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                TOTAL VALUE
              </p>
            </CardContent>
          </Card>
        </div>

        {/* BOLs Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Bills of Lading ({order.bolCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10" />
                  <TableHead className="min-w-[200px]">INVOICE / BOL</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead>ETD</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead className="text-center">CONTAINERS</TableHead>
                  <TableHead className="text-center">ITEMS</TableHead>
                  <TableHead className="text-right">VALUE</TableHead>
                  <TableHead className="text-right">WEIGHT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.bols.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No BOLs associated with this order.
                    </TableCell>
                  </TableRow>
                ) : (
                  order.bols.map((bol) => (
                    <TableRow key={bol.id} className="group cursor-pointer">
                      <TableCell className="pr-0">
                        <Link
                          href={`/bol/${encodeURIComponent(bol.bol)}`}
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-foreground"
                        >
                          <ChevronRight className="size-4" />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/bol/${encodeURIComponent(bol.bol)}`} className="block">
                          <span className="block font-semibold text-foreground">
                            {bol.invoice}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {bol.bol}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <BOLStatusBadge status={bol.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(bol.etd)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(bol.eta)}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {bol.containerCount}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {bol.itemCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-foreground">
                        {formatCurrency(bol.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {formatWeight(bol.totalWeight)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  if (status === "Completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
        <svg
          className="size-4"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="16" height="16" rx="3" fill="currentColor" fillOpacity="0.15" />
          <path
            d="M11.5 5.5L7 10.5L4.5 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Completed
      </span>
    )
  }
  if (status === "In Progress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-600">
        <span className="size-2 animate-pulse rounded-full bg-amber-500" />
        In Progress
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
      {status}
    </span>
  )
}

function BOLStatusBadge({ status }: { status: "Cleared" | "In Transit" }) {
  if (status === "Cleared") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        <svg
          className="size-3.5"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="16" height="16" rx="3" fill="currentColor" fillOpacity="0.15" />
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
      <span className="size-2 animate-pulse rounded-full bg-chart-3" />
      In Transit
    </span>
  )
}
