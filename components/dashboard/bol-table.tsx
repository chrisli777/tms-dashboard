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
import { ChevronRight, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react"
import { StatusBadge } from "@/components/ui/status-badge"
import { TrackingDateCell } from "./tracking-date-cell"
import {
  etdPlannedCellState,
  atdCellState,
  etaPlannedCellState,
  ataCellState,
} from "@/lib/tracking-rules"
import type { BOLSummary } from "@/lib/bol-data"

export type SortKey = "supplier" | "status" | "etd" | "atd" | "eta" | "ata"
export type SortDir = "asc" | "desc"

interface BOLTableProps {
  data: BOLSummary[]
  sortKey: SortKey | null
  sortDir: SortDir
  onSort: (key: SortKey) => void
}

/** A clickable header that toggles one-click sorting on its column. */
function SortableHead({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey | null
  dir: SortDir
  onSort: (key: SortKey) => void
}) {
  const active = activeKey === sortKey
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground ${
          active ? "text-foreground" : ""
        }`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? "text-foreground" : "text-muted-foreground/60"}`} />
      </button>
    </TableHead>
  )
}

export function BOLTable({ data, sortKey, sortDir, onSort }: BOLTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10" />
            <TableHead className="min-w-[280px]">BOL / INVOICE</TableHead>
            <SortableHead label="SUPPLIER" sortKey="supplier" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <TableHead className="text-center">CONTAINERS</TableHead>
            <SortableHead label="STATUS" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortableHead label="ETD" sortKey="etd" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortableHead label="ATD" sortKey="atd" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortableHead label="ETA" sortKey="eta" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortableHead label="ATA" sortKey="ata" activeKey={sortKey} dir={sortDir} onSort={onSort} />
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
                  <TrackingDateCell state={etdPlannedCellState(row)} kind="etd" />
                </TableCell>
                <TableCell>
                  <TrackingDateCell state={atdCellState(row)} kind="etd" />
                </TableCell>
                <TableCell>
                  <TrackingDateCell state={etaPlannedCellState(row)} kind="eta" />
                </TableCell>
                <TableCell>
                  <TrackingDateCell state={ataCellState(row)} kind="eta" />
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

