"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import type { DispatchContainer } from "@/lib/dispatch-data"

interface DispatchKPICardsProps {
  data: DispatchContainer[]
}

function formatCurrency(value: number) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`
  }
  return `$${value.toFixed(0)}`
}

function formatWeight(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}t`
  }
  return `${value.toFixed(0)} kg`
}

export function DispatchKPICards({ data }: DispatchKPICardsProps) {
  const stats = useMemo(() => {
    const totalContainers = data.length
    const scheduled = data.filter((c) => c.status === "Scheduled").length
    const delivered = data.filter((c) => c.status === "Delivered").length
    const totalQty = data.reduce((sum, c) => sum + c.totalQty, 0)
    const totalWeight = data.reduce((sum, c) => sum + c.totalWeight, 0)
    const totalValue = data.reduce((sum, c) => sum + c.totalAmount, 0)

    return { totalContainers, scheduled, delivered, totalQty, totalWeight, totalValue }
  }, [data])

  const cards = [
    {
      label: "TOTAL CONTAINERS",
      value: stats.totalContainers,
      color: "text-foreground",
      bgColor: "bg-muted/50",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
      ),
    },

    {
      label: "SCHEDULED",
      value: stats.scheduled,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      label: "DELIVERED",
      value: stats.delivered,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      ),
    },
    {
      label: "TOTAL UNITS",
      value: stats.totalQty.toLocaleString(),
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16.5 9.4 7.55 4.24"/>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.29 7 12 12 20.71 7"/>
          <line x1="12" x2="12" y1="22" y2="12"/>
        </svg>
      ),
    },
    {
      label: "TOTAL WEIGHT",
      value: formatWeight(stats.totalWeight),
      color: "text-slate-600",
      bgColor: "bg-slate-50",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="3"/><line x1="12" x2="12" y1="22" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
        </svg>
      ),
    },
    {
      label: "TOTAL VALUE",
      value: formatCurrency(stats.totalValue),
      color: "text-green-600",
      bgColor: "bg-green-50",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label} className={`${card.bgColor} border-0`}>
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center gap-2">
              <span className={card.color}>{card.icon}</span>
              <span className={`text-2xl font-bold tabular-nums ${card.color}`}>
                {card.value}
              </span>
            </div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {card.label}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
