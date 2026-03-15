"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, Truck, Loader2 } from "lucide-react"

interface ContainerItem {
  id: string
  sku: string
  qty: number
  gw_kg: number
  unit_price_usd: number
  amount_usd: number
  whi_po: string
}

interface Shipment {
  id: string
  invoice: string
  bol: string
  supplier: string
  customer: string
  etd: string
  eta: string
  status: string
}

interface Container {
  id: string
  container: string
  type: string
  status: string
  shipment_id: string
  container_items: ContainerItem[]
}

interface ContainerDetailProps {
  container: Container
  shipment: Shipment
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

// Container statuses - same as BOL but uses "Scheduled" instead of "Delivering"
const CONTAINER_STATUSES = [
  { value: "Booked", label: "Booked" },
  { value: "On Water", label: "On Water" },
  { value: "Customs Cleared", label: "Customs Cleared" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Delivered", label: "Delivered" },
] as const

export function ContainerDetail({ container, shipment }: ContainerDetailProps) {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const [isUpdating, setIsUpdating] = useState(false)
  // Initialize with actual container status from DB
  const [currentStatus, setCurrentStatus] = useState(container.status)

  const totalAmount = container.container_items.reduce(
    (sum, i) => sum + i.amount_usd,
    0
  )
  const totalWeight = container.container_items.reduce(
    (sum, i) => sum + i.gw_kg,
    0
  )
  const totalQty = container.container_items.reduce((sum, i) => sum + i.qty, 0)

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/containers/${container.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update status")
      }

      setCurrentStatus(newStatus)
      mutate(() => true, undefined, { revalidate: true })
      router.refresh()
    } catch (error) {
      console.error("Error updating status:", error)
      alert("Failed to update status. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Info bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Badge variant="outline" className="text-sm font-normal">
            {container.type}
          </Badge>
          <Link
            href={`/bol/${encodeURIComponent(shipment.bol)}`}
            className="font-medium text-primary hover:underline"
          >
            BOL: {shipment.bol}
          </Link>
          <span className="text-muted-foreground">
            {shipment.supplier}
          </span>
          <span className="text-muted-foreground">
            ETA: {formatDate(shipment.eta)}
          </span>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardContent className="px-6 py-5">
          <h2 className="mb-4 text-xs font-semibold tracking-wider text-muted-foreground">
            CONTAINER DELIVERY STATUS
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {CONTAINER_STATUSES.map((status) => {
              const isActive = currentStatus === status.value
              let bgClass = ""
              if (isActive) {
                if (status.value === "Delivered") bgClass = "bg-success hover:bg-success/90"
                else if (status.value === "Scheduled") bgClass = "bg-amber-500 hover:bg-amber-600"
                else if (status.value === "Customs Cleared") bgClass = "bg-blue-500 hover:bg-blue-600"
                else if (status.value === "On Water") bgClass = "bg-cyan-500 hover:bg-cyan-600"
                else bgClass = "bg-slate-500 hover:bg-slate-600"
              }
              return (
                <Button
                  key={status.value}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={`gap-2 ${bgClass}`}
                  onClick={() => handleStatusChange(status.value)}
                  disabled={isUpdating}
                >
                  {isUpdating && currentStatus === status.value ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : status.value === "Delivered" ? (
                    <Check className="size-4" />
                  ) : (
                    <Truck className="size-4" />
                  )}
                  {status.label}
                </Button>
              )
            })}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {currentStatus === "Delivered"
              ? "This container has been delivered to the warehouse."
              : currentStatus === "Scheduled"
                ? "This container is scheduled for delivery."
                : currentStatus === "Customs Cleared"
                  ? "This container has cleared customs and is ready for scheduling."
                  : currentStatus === "On Water"
                    ? "This container is in transit on the water."
                    : "This container is booked and awaiting shipment."}
          </p>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5 py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold tabular-nums text-primary">
              {container.container_items.length}
            </div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground">
              SKUs
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5 py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold tabular-nums text-primary">
              {totalQty.toLocaleString()}
            </div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground">
              TOTAL QTY
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5 py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold tabular-nums text-primary">
              {formatCurrency(totalAmount)}
            </div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground">
              TOTAL VALUE
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5 py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold tabular-nums text-primary">
              {totalWeight.toLocaleString()} lbs
            </div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground">
              TOTAL WEIGHT
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold text-foreground">
              Container Items ({container.container_items.length} SKUs)
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>SKU</TableHead>
                <TableHead>PO</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Weight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {container.container_items.map((item, idx) => (
                <TableRow key={`${item.sku}-${item.whi_po}-${idx}`}>
                  <TableCell className="font-medium text-foreground">
                    {item.sku}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/orders/${encodeURIComponent(item.whi_po)}`}
                      className="text-primary hover:underline"
                    >
                      {item.whi_po}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.qty.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(item.unit_price_usd)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-foreground">
                    {formatCurrency(item.amount_usd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {item.gw_kg.toLocaleString()} lbs
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
