"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import { ChevronRight, Check, Ship, AlertTriangle, Package } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusSelector, ORDER_STATUSES } from "@/components/ui/status-selector"
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

function getDaysRemaining(dueDate: string | null): { days: number; isUrgent: boolean } | null {
  if (!dueDate) return null
  const due = new Date(dueDate + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffTime = due.getTime() - today.getTime()
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return { days, isUrgent: days <= 15 }
}

const TIMELINE_STEPS = [
  { label: "Booked", step: 0 },
  { label: "On Water", step: 1 },
  { label: "Customs Cleared", step: 2 },
  { label: "Delivering", step: 3 },
  { label: "Delivered", step: 4 },
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

export function OrderDetail({ order }: OrderDetailProps) {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const [currentStatus, setCurrentStatus] = useState(order.status)
  
  const clearedBOLs = order.bols.filter((b) => 
    b.status === "Cleared" || b.status === "Customs Cleared"
  ).length
  const inTransitBOLs = order.bols.filter((b) => 
    b.status === "In Transit" || b.status === "On Water"
  ).length
  const deliveringBOLs = order.bols.filter((b) => 
    b.status === "Delivering"
  ).length
  const deliveredBOLs = order.bols.filter((b) => 
    b.status === "Delivered" || b.status === "Closed"
  ).length

  const handleStatusChange = async (newStatus: string) => {
    const previousStatus = currentStatus
    setCurrentStatus(newStatus)
    
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        setCurrentStatus(previousStatus)
        throw new Error("Failed to update status")
      }

      mutate(() => true, undefined, { revalidate: true })
      router.refresh()
    } catch (error) {
      console.error("Error updating status:", error)
      alert("Failed to update status. Please try again.")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Order info header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Supplier:</span> {order.supplier} • <span className="font-medium text-foreground">Customer:</span> {order.customer} • Order Date: {formatDate(order.orderDate)}
          </p>
          {order.dueDate && (
            <DueDateDisplay dueDate={order.dueDate} isComplete={order.progressPercent === 100 || order.status === "Completed"} />
          )}
        </div>
        <StatusSelector
          currentStatus={currentStatus}
          statuses={ORDER_STATUSES}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
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
        <Card className="border-blue-500/20 bg-blue-500/5 py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold tabular-nums text-blue-600">
              {deliveringBOLs + deliveredBOLs}
            </div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground">
              DELIVERED
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
            <div className="text-xl font-bold tabular-nums text-primary">
              {formatCurrency(order.totalAmount)}
            </div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground">
              TOTAL VALUE
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Items Section (for Pending orders) */}
      {order.status === "Pending" && order.pendingItems.length > 0 && (
        <div>
          <h2 className="mb-4 text-xs font-semibold tracking-wider text-muted-foreground">
            PENDING ITEMS ({order.pendingItems.length} SKUs)
          </h2>
          
          {/* Progress Bar */}
          <Card className="mb-4">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Order Progress</h3>
                  <p className="text-sm text-muted-foreground">
                    {order.totalQtyReceived.toLocaleString()} of {order.totalQtyOrdered.toLocaleString()} units received
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-primary">{order.progressPercent}%</span>
                </div>
              </div>
              <Progress value={order.progressPercent} className="h-3" />
            </CardContent>
          </Card>

          {/* Pending Items Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>SKU</TableHead>
                    <TableHead>DESCRIPTION</TableHead>
                    <TableHead className="text-right">QTY ORDERED</TableHead>
                    <TableHead className="text-right">QTY RECEIVED</TableHead>
                    <TableHead className="text-right">UNIT COST</TableHead>
                    <TableHead className="text-right">AMOUNT</TableHead>
                    <TableHead className="text-center">PROGRESS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.pendingItems.map((item) => {
                    const itemProgress = item.qtyOrdered > 0 
                      ? Math.round((item.qtyReceived / item.qtyOrdered) * 100) 
                      : 0
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono font-medium">{item.sku}</TableCell>
                        <TableCell className="text-muted-foreground">{item.description || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.qtyOrdered.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.qtyReceived.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(item.unitCost)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(item.amount)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Progress value={itemProgress} className="h-2 w-16" />
                            <span className="text-xs text-muted-foreground">{itemProgress}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* BOLs List */}
      <div>
        <h2 className="mb-4 text-xs font-semibold tracking-wider text-muted-foreground">
          BILLS OF LADING ({order.bolCount})
        </h2>
        <div className="flex flex-col gap-4">
          {order.bols.length === 0 ? (
            <Card>
              <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
                No BOLs associated with this order.
              </CardContent>
            </Card>
          ) : (
            order.bols.map((bol) => {
              const currentStep = getCurrentStep(bol.status)
              return (
                <Card key={bol.id}>
                  <CardContent className="p-0">
                    {/* BOL Header */}
                    <Link
                      href={`/bol/${encodeURIComponent(bol.bol)}`}
                      className="flex items-center justify-between border-b px-5 py-4 transition-colors hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="block font-semibold text-foreground">
                            {bol.bol}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Invoice: {bol.invoice}
                          </span>
                        </div>
                        <BOLStatusBadge status={bol.status} />
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {bol.containerCount} containers
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(bol.totalAmount)}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </Link>

                    {/* BOL Details */}
                    <div className="px-5 py-4">
                      <div className="mb-4 grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                            ETD
                          </p>
                          <p className="font-medium text-foreground">
                            {formatDate(bol.etd)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                            ETA
                          </p>
                          <p className="font-medium text-foreground">
                            {formatDate(bol.eta)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                            ITEMS
                          </p>
                          <p className="font-medium text-foreground">
                            {bol.itemCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                            WEIGHT
                          </p>
                          <p className="font-medium text-foreground">
                            {formatWeight(bol.totalWeight)}
                          </p>
                        </div>
                      </div>

                      {/* Mini Status Timeline */}
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
                              <div className="flex flex-col items-center gap-1">
                                <div
                                  className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${
                                    isCompleted
                                      ? isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-success text-success-foreground"
                                      : "border border-border bg-card text-muted-foreground"
                                  }`}
                                >
                                  {isCompleted && !isActive ? (
                                    <Check className="size-3" />
                                  ) : (
                                    step.step + 1
                                  )}
                                </div>
                                <span
                                  className={`whitespace-nowrap text-[10px] font-medium ${
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
                                  className={`mx-1 mt-[-14px] h-0.5 flex-1 rounded-full ${
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
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function DueDateDisplay({ dueDate, isComplete }: { dueDate: string; isComplete: boolean }) {
  const remaining = getDaysRemaining(dueDate)

  if (isComplete) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Due: {formatDate(dueDate)}</span>
        <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
          <Check className="size-3" />
          Done
        </span>
      </p>
    )
  }

  if (remaining) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Due: {formatDate(dueDate)}</span>
        {remaining.days <= 0 ? (
          <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            <AlertTriangle className="size-3" />
            Overdue
          </span>
        ) : remaining.isUrgent ? (
          <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            <AlertTriangle className="size-3" />
            {remaining.days} days left
          </span>
        ) : (
          <span className="text-muted-foreground">{remaining.days} days left</span>
        )}
      </p>
    )
  }

  return (
    <p className="text-sm text-muted-foreground">Due: {formatDate(dueDate)}</p>
  )
}

function BOLStatusBadge({ status }: { status: string }) {
  if (status === "Cleared" || status === "Customs Cleared") {
    return (
      <Badge className="bg-success/10 text-success hover:bg-success/20">
        <Check className="mr-1 size-3" />
        Customs Cleared
      </Badge>
    )
  }
  if (status === "Delivered" || status === "Closed") {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">
        <Check className="mr-1 size-3" />
        {status}
      </Badge>
    )
  }
  if (status === "Delivering") {
    return (
      <Badge className="bg-purple-500/10 text-purple-600 hover:bg-purple-500/20">
        <Ship className="mr-1 size-3" />
        Delivering
      </Badge>
    )
  }
  if (status === "Booked") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Booked
      </Badge>
    )
  }
  return (
    <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
      <span className="mr-1.5 size-2 animate-pulse rounded-full bg-amber-500" />
      {status === "In Transit" ? "In Transit" : status}
    </Badge>
  )
}
