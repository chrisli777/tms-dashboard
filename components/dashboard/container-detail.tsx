"use client"

import Link from "next/link"
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
import { StatusBadge } from "@/components/ui/status-badge"
import type { DispatchContainer } from "@/lib/dispatch-data"

interface ContainerDetailProps {
  container: DispatchContainer
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—"
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

export function ContainerDetail({ container }: ContainerDetailProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Info bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Badge variant="outline" className="text-sm font-normal">
            {container.type}
          </Badge>
          <Link
            href={`/bol/${encodeURIComponent(container.bol)}`}
            className="font-medium text-primary hover:underline"
          >
            BOL: {container.bol}
          </Link>
          <span className="text-muted-foreground">{container.supplier}</span>
          <span className="text-muted-foreground">
            ETA: {formatDate(container.eta)}
          </span>
          <StatusBadge status={container.status} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5 py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold tabular-nums text-primary">
              {container.skuCount}
            </div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground">
              SKUs
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5 py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold tabular-nums text-primary">
              {container.totalQty.toLocaleString()}
            </div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground">
              TOTAL QTY
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5 py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold tabular-nums text-primary">
              {formatCurrency(container.totalAmount)}
            </div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground">
              TOTAL VALUE
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5 py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold tabular-nums text-primary">
              {container.totalWeight.toLocaleString()} kg
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
              Container Items ({container.skuCount} SKUs)
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>SKU</TableHead>
                <TableHead>PO</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Weight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {container.items.map((item, idx) => (
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
                  <TableCell className="text-right font-medium tabular-nums text-foreground">
                    {formatCurrency(item.amount_usd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {item.gw_kg.toLocaleString()} kg
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
