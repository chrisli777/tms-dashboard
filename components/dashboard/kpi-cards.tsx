"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Package, Ship, CircleCheck, DollarSign, Weight } from "lucide-react"
import type { BOLRecord } from "@/lib/bol-data"

interface KPICardsProps {
  data: BOLRecord[]
}

export function KPICards({ data }: KPICardsProps) {
  const totalOrders = data.length
  const totalAmount = data.reduce((sum, r) => sum + r.amount, 0)
  const totalQty = data.reduce((sum, r) => sum + r.qty, 0)
  const totalWeight = data.reduce((sum, r) => sum + r.gw, 0)
  const clearedCount = data.filter((r) => r.status === "Cleared").length
  const inTransitCount = data.filter((r) => r.status === "In Transit").length

  const cards = [
    {
      label: "Total Records",
      value: totalOrders.toLocaleString(),
      icon: Package,
      accent: "bg-primary/10 text-primary",
    },
    {
      label: "Total Amount",
      value: `$${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      accent: "bg-chart-2/10 text-chart-2",
    },
    {
      label: "Total Qty",
      value: totalQty.toLocaleString(),
      icon: Weight,
      accent: "bg-chart-3/10 text-chart-3",
    },
    {
      label: "Cleared",
      value: clearedCount.toLocaleString(),
      icon: CircleCheck,
      accent: "bg-success/10 text-success",
    },
    {
      label: "In Transit",
      value: inTransitCount.toLocaleString(),
      icon: Ship,
      accent: "bg-chart-5/10 text-chart-5",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 md:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label} className="py-4">
          <CardContent className="flex items-center gap-4 px-5">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${card.accent}`}>
              <card.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="truncate text-lg font-semibold tracking-tight text-card-foreground">
                {card.value}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
