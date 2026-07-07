"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronRight, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react"
import { DispatchStatusSelect } from "./dispatch-status-select"
import { DispatchDateCell } from "./dispatch-date-cell"
import { DispatchAssignmentCell } from "./dispatch-assignment-cell"
import { WAREHOUSE_OPTIONS, VENDOR_OPTIONS } from "@/lib/dispatch-options"
import type { DispatchContainer } from "@/lib/dispatch-data"

export type SortKey =
  | "supplier"
  | "status"
  | "atd"
  | "ata"
  | "lfd"
  | "planned_pickup_date"
  | "warehouse"
export type SortDir = "asc" | "desc"

interface DispatchTableProps {
  data: DispatchContainer[]
  sortKey: SortKey | null
  sortDir: SortDir
  onSort: (key: SortKey) => void
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—"
  // Parse as local midnight so the date is identical on server (UTC) and client
  // (local tz). A bare "2026-02-05" would parse as UTC midnight and shift a day
  // in negative-offset timezones, causing a hydration mismatch.
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/** A clickable header that toggles one-click sorting on its column. */
function SortableHead({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey | null
  dir: SortDir
  onSort: (key: SortKey) => void
  align?: "left" | "right"
}) {
  const active = activeKey === sortKey
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground ${
          active ? "text-foreground" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? "text-foreground" : "text-muted-foreground/60"}`} />
      </button>
    </TableHead>
  )
}

export function DispatchTable({ data, sortKey, sortDir, onSort }: DispatchTableProps) {
  const router = useRouter()

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10"></TableHead>
            <TableHead>CONTAINER</TableHead>
            <TableHead>BOL</TableHead>
            <SortableHead label="SUPPLIER" sortKey="supplier" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortableHead label="STATUS" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortableHead label="ATD" sortKey="atd" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortableHead label="ATA" sortKey="ata" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortableHead label="LFD" sortKey="lfd" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <SortableHead
              label="PLANNED DATE"
              sortKey="planned_pickup_date"
              activeKey={sortKey}
              dir={sortDir}
              onSort={onSort}
            />
            <SortableHead label="WAREHOUSE" sortKey="warehouse" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <TableHead>VENDOR</TableHead>
            <TableHead className="text-right">QTY</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                No containers found
              </TableCell>
            </TableRow>
          ) : (
            data.map((container) => (
              <TableRow
                key={container.id}
                className="group cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/container/${container.id}?from=/dispatch`)}
              >
                <TableCell>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/container/${container.id}?from=/dispatch`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {container.container}
                  </Link>
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
                  <DispatchStatusSelect
                    container={container.container}
                    bol={container.bol}
                    status={container.status}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(container.atd)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(container.ata)}
                </TableCell>
                <TableCell>
                  <DispatchDateCell
                    container={container.container}
                    bol={container.bol}
                    field="lfd"
                    value={container.lfd}
                    label="LFD"
                  />
                </TableCell>
                <TableCell>
                  <DispatchDateCell
                    container={container.container}
                    bol={container.bol}
                    field="planned_pickup_date"
                    value={container.planned_pickup_date}
                    label="Planned Date"
                  />
                </TableCell>
                <TableCell>
                  <DispatchAssignmentCell
                    container={container.container}
                    bol={container.bol}
                    field="warehouse"
                    value={container.warehouse}
                    options={WAREHOUSE_OPTIONS}
                    placeholder="Warehouse"
                    label="Warehouse"
                  />
                </TableCell>
                <TableCell>
                  <DispatchAssignmentCell
                    container={container.container}
                    bol={container.bol}
                    field="vendor"
                    value={container.vendor}
                    options={VENDOR_OPTIONS}
                    placeholder="Assign"
                    label="Vendor"
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {container.totalQty.toLocaleString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
