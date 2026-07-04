"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { BOLSummary } from "@/lib/bol-data"

interface KPICardsProps {
  data: BOLSummary[]
}

export function KPICards({ data }: KPICardsProps) {
  const totalShipments = data.length
  const totalContainers = data.reduce((sum, r) => sum + r.containerCount, 0)
  // Derived lifecycle statuses: "Pending", "In Transit", "Arrived"
  const pendingCount = data.filter((r) => r.status === "Pending").length
  const inTransitCount = data.filter((r) => r.status === "In Transit").length
  const arrivedCount = data.filter((r) => r.status === "Arrived").length

  const cards = [
    {
      label: "ACTIVE SHIPMENTS",
      value: totalShipments.toString(),
      iconClass: "text-primary",
      cardClass: "border-primary/20 bg-primary/5",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
      ),
    },
    {
      label: "PENDING",
      value: pendingCount.toString(),
      iconClass: "text-slate-500",
      cardClass: "border-slate-500/20 bg-slate-500/5",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ),
    },
    {
      label: "IN TRANSIT",
      value: inTransitCount.toString(),
      iconClass: "text-amber-600",
      cardClass: "border-amber-500/20 bg-amber-500/5",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg>
      ),
    },
    {
      label: "ARRIVED",
      value: arrivedCount.toString(),
      iconClass: "text-success",
      cardClass: "border-success/20 bg-success/5",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      ),
    },
    {
      label: "CONTAINERS",
      value: totalContainers.toString(),
      iconClass: "text-primary",
      cardClass: "border-primary/20 bg-primary/5",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className={`${card.cardClass} py-4`}>
          <CardContent className="flex flex-col gap-1 px-4">
            <div className={`flex items-center gap-2 ${card.iconClass}`}>
              {card.icon}
              <span className="text-2xl font-bold tabular-nums">
                {card.value}
              </span>
            </div>
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">
              {card.label}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
