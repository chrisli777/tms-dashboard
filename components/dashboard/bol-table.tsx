"use client"

import { useState, useMemo } from "react"
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
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react"
import type { BOLRecord } from "@/lib/bol-data"

interface BOLTableProps {
  data: BOLRecord[]
}

type SortKey = keyof BOLRecord
type SortDir = "asc" | "desc"

const PAGE_SIZE = 15

export function BOLTable({ data }: BOLTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("etd")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal
      }
      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
  }, [data, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
    setPage(0)
  }

  const columns: { key: SortKey; label: string; align?: "right" }[] = [
    { key: "invoice", label: "Invoice" },
    { key: "blNo", label: "BL No." },
    { key: "whiPo", label: "WHI PO" },
    { key: "container", label: "Container" },
    { key: "type", label: "Type" },
    { key: "sku", label: "SKU" },
    { key: "qty", label: "Qty", align: "right" },
    { key: "gw", label: "GW(kg)", align: "right" },
    { key: "unitPrice", label: "Unit Price", align: "right" },
    { key: "amount", label: "Amount(USD)", align: "right" },
    { key: "etd", label: "ETD" },
    { key: "eta", label: "ETA" },
    { key: "status", label: "Status" },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`cursor-pointer select-none ${col.align === "right" ? "text-right" : ""}`}
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown
                      className={`size-3 ${sortKey === col.key ? "text-primary" : "text-muted-foreground/40"}`}
                    />
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row, idx) => (
                <TableRow key={`${row.container}-${row.sku}-${idx}`}>
                  <TableCell className="font-medium text-foreground">
                    {row.invoice}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {"..." + row.blNo.slice(-8)}
                  </TableCell>
                  <TableCell>{row.whiPo}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.container}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {row.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.sku}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.qty.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.gw.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${row.unitPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    ${row.amount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>{row.etd}</TableCell>
                  <TableCell>{row.eta}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {paged.length === 0 ? 0 : page * PAGE_SIZE + 1}
          {"-"}
          {Math.min((page + 1) * PAGE_SIZE, sorted.length)} of{" "}
          {sorted.length} records
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="size-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page + 1} / {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="size-4" />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: BOLRecord["status"] }) {
  if (status === "Cleared") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
        <span className="size-1.5 rounded-full bg-success" />
        Cleared
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-chart-5/10 px-2.5 py-0.5 text-xs font-medium text-chart-5">
      <span className="size-1.5 animate-pulse rounded-full bg-chart-5" />
      In Transit
    </span>
  )
}
