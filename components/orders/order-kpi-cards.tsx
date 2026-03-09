"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { OrderSummary } from "@/lib/order-data"

interface OrderKPICardsProps {
  data: OrderSummary[]
}

export function OrderKPICards({ data }: OrderKPICardsProps) {
  const totalOrders = data.length
  const totalAmount = data.reduce((sum, o) => sum + o.totalAmount, 0)
  const totalBOLs = data.reduce((sum, o) => sum + o.bolCount, 0)
  const totalContainers = data.reduce((sum, o) => sum + o.containerCount, 0)
  const completedCount = data.filter((o) => o.status === "Completed").length
  const inProgressCount = data.filter((o) => o.status === "In Progress").length
  const inProgressValue = data
    .filter((o) => o.status === "In Progress")
    .reduce((sum, o) => sum + o.totalAmount, 0)

  const cards = [
    {
      label: "TOTAL ORDERS",
      value: totalOrders.toString(),
      iconClass: "text-primary",
      cardClass: "border-primary/20 bg-primary/5",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>
      ),
    },
    {
      label: "IN PROGRESS",
      value: inProgressCount.toString(),
      iconClass: "text-amber-600",
      cardClass: "border-amber-500/20 bg-amber-500/5",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ),
    },
    {
      label: "COMPLETED",
      value: completedCount.toString(),
      iconClass: "text-success",
      cardClass: "border-success/20 bg-success/5",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      ),
    },
    {
      label: "TOTAL BOLS",
      value: totalBOLs.toString(),
      iconClass: "text-primary",
      cardClass: "border-primary/20 bg-primary/5",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
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
    {
      label: "TOTAL VALUE",
      value: `$${Math.round(totalAmount / 1000).toLocaleString()}K`,
      iconClass: "text-primary",
      cardClass: "border-primary/20 bg-primary/5",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
