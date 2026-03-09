"use client"

import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronRight } from "lucide-react"
import type { BOLSummary } from "@/lib/bol-data"

interface BOLTableProps {
  data: BOLSummary[]
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

function formatWeight(value: number) {
  return `${value.toLocaleString()} lbs`
}

export function BOLTable({ data }: BOLTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10" />
            <TableHead className="min-w-[280px]">INVOICE / BOL</TableHead>
            <TableHead>SUPPLIER</TableHead>
            <TableHead className="text-center">CONTAINERS</TableHead>
            <TableHead>STATUS</TableHead>
            <TableHead>ETD</TableHead>
            <TableHead>ETA</TableHead>
            <TableHead className="text-right">VALUE</TableHead>
            <TableHead className="text-right">WEIGHT</TableHead>
            <TableHead className="text-right">POS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={10}
                className="h-32 text-center text-muted-foreground"
              >
                No shipments found.
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow
                key={`${row.invoice}-${row.bol}`}
                className="group cursor-pointer"
              >
                <TableCell className="pr-0">
                  <Link
                    href={`/bol/${encodeURIComponent(row.bol)}`}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-foreground"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/bol/${encodeURIComponent(row.bol)}`}
                    className="block"
                  >
                    <span className="block font-semibold text-foreground">
                      {row.invoice}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {row.bol}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-primary">{row.supplier}</span>
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {row.containerCount}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(row.etd)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(row.eta)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  {formatCurrency(row.totalAmount)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {formatWeight(row.totalWeight)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {row.poCount} {row.poCount === 1 ? "PO" : "POs"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Customs Cleared" || status === "Cleared" || status === "Delivered" || status === "Closed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        <svg
          className="size-3.5"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="16" height="16" rx="3" fill="currentColor" fillOpacity="0.15" />
          <path
            d="M11.5 5.5L7 10.5L4.5 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {status === "Cleared" ? "Customs Cleared" : status}
      </span>
    )
  }
  if (status === "Booked") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        Booked
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-chart-3/10 px-2.5 py-1 text-xs font-medium text-chart-3">
      <span className="size-2 animate-pulse rounded-full bg-chart-3" />
      {status === "In Transit" ? "In Transit" : status}
    </span>
  )
}
