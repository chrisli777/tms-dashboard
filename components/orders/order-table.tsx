"use client"

import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronRight } from "lucide-react"
import type { OrderSummary } from "@/lib/order-data"

interface OrderTableProps {
  data: OrderSummary[]
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

function formatWeight(value: number) {
  return `${value.toLocaleString()} lbs`
}

export function OrderTable({ data }: OrderTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10" />
            <TableHead className="min-w-[140px]">PO NUMBER</TableHead>
            <TableHead>SUPPLIER</TableHead>
            <TableHead>CUSTOMER</TableHead>
            <TableHead>ORDER DATE</TableHead>
            <TableHead>STATUS</TableHead>
            <TableHead className="text-center">BOLS</TableHead>
            <TableHead className="text-center">CONTAINERS</TableHead>
            <TableHead className="text-right">VALUE</TableHead>
            <TableHead className="text-right">WEIGHT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={10}
                className="h-32 text-center text-muted-foreground"
              >
                No orders found.
              </TableCell>
            </TableRow>
          ) : (
            data.map((order) => (
              <TableRow
                key={order.id}
                className="group cursor-pointer"
              >
                <TableCell className="pr-0">
                  <Link
                    href={`/orders/${encodeURIComponent(order.poNumber)}`}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-foreground"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/orders/${encodeURIComponent(order.poNumber)}`}
                    className="block"
                  >
                    <span className="block font-semibold text-foreground">
                      PO-{order.poNumber}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-primary">{order.supplier}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {order.customer}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(order.orderDate)}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {order.bolCount}
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {order.containerCount}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  {formatCurrency(order.totalAmount)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {formatWeight(order.totalWeight)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  if (status === "Completed") {
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
        Completed
      </span>
    )
  }
  if (status === "In Progress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
        <span className="size-2 animate-pulse rounded-full bg-amber-500" />
        In Progress
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {status}
    </span>
  )
}
