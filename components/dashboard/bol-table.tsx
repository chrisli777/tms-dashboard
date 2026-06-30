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
import { StatusBadge } from "@/components/ui/status-badge"
import { TrackingDateCell } from "./tracking-date-cell"
import { etdCellState, etaCellState } from "@/lib/tracking-rules"
import type { BOLSummary } from "@/lib/bol-data"

interface BOLTableProps {
  data: BOLSummary[]
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
            <TableHead className="min-w-[280px]">BOL / INVOICE</TableHead>
            <TableHead>SUPPLIER</TableHead>
            <TableHead className="text-center">CONTAINERS</TableHead>
            <TableHead>STATUS</TableHead>
            <TableHead>ETD / ATD</TableHead>
            <TableHead>ETA / ATA</TableHead>
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
                      {row.bol}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {row.invoice}
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
                <TableCell>
                  <TrackingDateCell state={etdCellState(row)} kind="etd" />
                </TableCell>
                <TableCell>
                  <TrackingDateCell state={etaCellState(row)} kind="eta" />
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

