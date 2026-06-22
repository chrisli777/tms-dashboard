"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { ChevronRight, AlertTriangle, Check } from "lucide-react"
import { StatusBadge } from "@/components/ui/status-badge"
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

function getDaysRemaining(dueDate: string | null): { days: number; isUrgent: boolean } | null {
  if (!dueDate) return null
  const due = new Date(dueDate + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffTime = due.getTime() - today.getTime()
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return { days, isUrgent: days <= 15 }
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
            <TableHead>STATUS</TableHead>
            <TableHead className="min-w-[180px]">PROGRESS</TableHead>
            <TableHead>DUE DATE</TableHead>
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
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell>
                  <ProgressCell order={order} />
                </TableCell>
                <TableCell>
                  <DueDateCell order={order} />
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

function ProgressCell({ order }: { order: OrderSummary }) {
  // All orders show unit-based progress
  const totalOrdered = order.totalQtyOrdered ?? 0
  const totalReceived = order.totalQtyReceived ?? 0
  const percent = order.progressPercent ?? 100

  if (totalOrdered === 0) {
    // Fallback for orders without qty data - show as complete
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Complete</span>
          <span className="font-medium">100%</span>
        </div>
        <Progress value={100} className="h-2" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {totalReceived.toLocaleString()} / {totalOrdered.toLocaleString()} units
        </span>
        <span className="font-medium">{percent}%</span>
      </div>
      <Progress value={percent} className="h-2" />
    </div>
  )
}

function DueDateCell({ order }: { order: OrderSummary }) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!order.dueDate) {
    return <span className="text-xs text-muted-foreground">-</span>
  }

  const isComplete = order.status === "Cleared" || order.progressPercent === 100

  if (isComplete) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">{formatDate(order.dueDate)}</span>
        <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">
          <Check className="size-3" />
          Done
        </span>
      </div>
    )
  }

  // Only calculate days remaining on client to avoid hydration mismatch
  if (!mounted) {
    return <span className="text-sm text-muted-foreground">{formatDate(order.dueDate)}</span>
  }

  const remaining = getDaysRemaining(order.dueDate)

  if (remaining) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">{formatDate(order.dueDate)}</span>
        {remaining.days <= 0 ? (
          <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
            <AlertTriangle className="size-3" />
            Overdue
          </span>
        ) : remaining.isUrgent ? (
          <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
            <AlertTriangle className="size-3" />
            {remaining.days}d left
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{remaining.days}d left</span>
        )}
      </div>
    )
  }

  return <span className="text-sm text-muted-foreground">{formatDate(order.dueDate)}</span>
}
