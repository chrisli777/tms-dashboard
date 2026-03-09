"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronRight } from "lucide-react"
import type { DispatchContainer } from "@/lib/dispatch-data"

interface DispatchTableProps {
  data: DispatchContainer[]
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Delivered") {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Delivered
      </Badge>
    )
  }
  if (status === "Scheduled") {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        Scheduled
      </Badge>
    )
  }
  // Customs Cleared
  return (
    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
      Customs Cleared
    </Badge>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function DispatchTable({ data }: DispatchTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10"></TableHead>
            <TableHead>CONTAINER</TableHead>
            <TableHead>TYPE</TableHead>
            <TableHead>BOL</TableHead>
            <TableHead>SUPPLIER</TableHead>
            <TableHead>STATUS</TableHead>
            <TableHead>ETD</TableHead>
            <TableHead>ETA</TableHead>
            <TableHead className="text-right">QTY</TableHead>
            <TableHead className="text-right">WEIGHT</TableHead>
            <TableHead className="text-right">VALUE</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                No containers found
              </TableCell>
            </TableRow>
          ) : (
            data.map((container) => (
              <TableRow
                key={container.id}
                className="group cursor-pointer hover:bg-muted/50"
              >
                <TableCell>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/dispatch/${container.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {container.container}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {container.type}
                  </span>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/bol/${container.bol}`}
                    className="font-mono text-sm text-muted-foreground hover:text-primary"
                  >
                    {container.bol.slice(0, 12)}...
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-primary">{container.supplier}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={container.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(container.etd)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(container.eta)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {container.totalQty.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {container.totalWeight.toLocaleString()} kg
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(container.totalAmount)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
