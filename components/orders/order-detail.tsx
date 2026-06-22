"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ChevronRight, Check, AlertTriangle, Calendar, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/ui/status-badge"
import { STATUS_STEPS, getStatusStep } from "@/lib/status"
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

export function OrderDetail({ order }: OrderDetailProps) {
  const clearedBOLs = order.bols.filter((b) => b.status === "Cleared").length
  const inTransitBOLs = order.bols.filter((b) =>
    b.status === "In Transit" || b.status === "On Water"
  ).length

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Order info header */}
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Supplier:</span> {order.supplier} • <span className="font-medium text-foreground">Customer:</span> {order.customer} • Order Date: {formatDate(order.orderDate)}
        </p>
        <StatusBadge status={order.status} />
      </div>

      {/* Progress and Due Date Cards - Side by Side */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Order Progress Card */}
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                <TrendingUp className="size-4 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Order Execution Progress</h3>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {order.totalQtyReceived?.toLocaleString() ?? 0} of {order.totalQtyOrdered?.toLocaleString() ?? 0} units
              </p>
              <span className="text-2xl font-bold text-primary">{order.progressPercent ?? 100}%</span>
            </div>
            <Progress value={order.progressPercent ?? 100} className="h-3" />
          </CardContent>
        </Card>

        {/* Due Date Card */}
        <Card className={`${
          order.status === "Cleared" || (order.progressPercent ?? 100) === 100
            ? "border-success/20"
            : order.dueDate && getDaysRemaining(order.dueDate)?.isUrgent
              ? "border-destructive/20"
              : "border-border"
        }`}>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className={`flex size-8 items-center justify-center rounded-full ${
                order.status === "Cleared" || (order.progressPercent ?? 100) === 100
                  ? "bg-success/10"
                  : order.dueDate && getDaysRemaining(order.dueDate)?.isUrgent
                    ? "bg-destructive/10"
                    : "bg-muted"
              }`}>
                <Calendar className={`size-4 ${
                  order.status === "Cleared" || (order.progressPercent ?? 100) === 100
                    ? "text-success"
                    : order.dueDate && getDaysRemaining(order.dueDate)?.isUrgent
                      ? "text-destructive"
                      : "text-muted-foreground"
                }`} />
              </div>
              <h3 className="font-semibold text-foreground">Due Date</h3>
            </div>
            <DueDateCardContent dueDate={order.dueDate} isComplete={order.status === "Cleared" || (order.progressPercent ?? 100) === 100} />
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
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
              const currentStep = getStatusStep(bol.status)
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
                        <StatusBadge status={bol.status} />
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
                        {STATUS_STEPS.map((step, idx) => {
                          const isCompleted = step.step <= currentStep
                          const isActive = step.step === currentStep
                          const isLast = idx === STATUS_STEPS.length - 1

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

function DueDateCardContent({ dueDate, isComplete }: { dueDate: string | null; isComplete: boolean }) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!dueDate) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-muted-foreground">-</span>
        <span className="text-sm text-muted-foreground">No due date set</span>
      </div>
    )
  }

  if (isComplete) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-foreground">{formatDate(dueDate)}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-sm font-semibold text-success">
          <Check className="size-4" />
          Done
        </span>
      </div>
    )
  }

  // Only calculate days remaining on client to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-foreground">{formatDate(dueDate)}</span>
      </div>
    )
  }

  const remaining = getDaysRemaining(dueDate)

  return (
    <div className="flex items-center justify-between">
      <span className="text-2xl font-bold text-foreground">{formatDate(dueDate)}</span>
      {remaining && (
        remaining.days <= 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            Overdue
          </span>
        ) : remaining.isUrgent ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            {remaining.days} days left
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
            {remaining.days} days left
          </span>
        )
      )}
    </div>
  )
}


