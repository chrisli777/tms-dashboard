"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Package, Ship, CircleCheck, DollarSign, Boxes } from "lucide-react"
import type { BOLSummary } from "@/lib/bol-data"

interface KPICardsProps {
  data: BOLSummary[]
}

export function KPICards({ data }: KPICardsProps) {
  const totalShipments = data.length
  const totalAmount = data.reduce((sum, r) => sum + r.totalAmount, 0)
  const totalContainers = data.reduce((sum, r) => sum + r.containerCount, 0)
  const clearedCount = data.filter((r) => r.status === "Cleared").length
  const inTransitCount = data.filter((r) => r.status === "In Transit").length
  const inTransitValue = data
    .filter((r) => r.status === "In Transit")
    .reduce((sum, r) => sum + r.totalAmount, 0)

  const cards = [
    {
      label: "ACTIVE SHIPMENTS",
      value: totalShipments.toString(),
      icon: Package,
      color: "text-primary",
      bg: "bg-primary/8",
      border: "border-primary/20",
    },
    {
      label: "IN TRANSIT",
      value: inTransitCount.toString(),
      icon: Ship,
      color: "text-chart-3",
      bg: "bg-chart-3/8",
      border: "border-chart-3/20",
    },
    {
      label: "CLEARED",
      value: clearedCount.toString(),
      icon: CircleCheck,
      color: "text-success",
      bg: "bg-success/8",
      border: "border-success/20",
    },
    {
      label: "CONTAINERS",
      value: totalContainers.toString(),
      icon: Boxes,
      color: "text-chart-4",
      bg: "bg-chart-4/8",
      border: "border-chart-4/20",
    },
    {
      label: "TOTAL VALUE",
      value: `$${Math.round(totalAmount / 1000).toLocaleString()}K`,
      icon: DollarSign,
      color: "text-primary",
      bg: "bg-primary/8",
      border: "border-primary/20",
    },
    {
      label: "VALUE IN TRANSIT",
      value: `$${Math.round(inTransitValue / 1000).toLocaleString()}K`,
      icon: DollarSign,
      color: "text-chart-3",
      bg: "bg-chart-3/8",
      border: "border-chart-3/20",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label} className={`border ${card.border} ${card.bg} py-4`}>
          <CardContent className="flex flex-col gap-1 px-4">
            <div className="flex items-center gap-2">
              <card.icon className={`size-4 ${card.color}`} />
              <span className={`text-2xl font-bold tabular-nums ${card.color}`}>
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
