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
import { TrackingDateCell } from "./tracking-date-cell"
import { ManualTrackingEditor } from "./manual-tracking-editor"
import { DispatchStatusSelect } from "@/components/dispatch/dispatch-status-select"
import { DispatchDateCell } from "@/components/dispatch/dispatch-date-cell"
import { DispatchAssignmentCell } from "@/components/dispatch/dispatch-assignment-cell"
import { DeleteContainerButton } from "@/components/dispatch/delete-container-button"
import { WAREHOUSE_OPTIONS, VENDOR_OPTIONS } from "@/lib/dispatch-options"
import { etdCellState, etaCellState } from "@/lib/tracking-rules"
import type { DispatchContainer } from "@/lib/dispatch-data"

interface ContainerDetailProps {
  container: DispatchContainer
}

export function ContainerDetail({ container }: ContainerDetailProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-4 text-base">
        <Link
          href={`/bol/${encodeURIComponent(container.bol)}`}
          className="font-medium text-primary hover:underline"
        >
          BOL: {container.bol}
        </Link>
        <span className="text-muted-foreground">{container.supplier}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="font-semibold">ETD/ATD:</span>
          <TrackingDateCell state={etdCellState(container)} kind="etd" inline />
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="font-semibold">ETA/ATA:</span>
          <TrackingDateCell state={etaCellState(container)} kind="eta" inline />
        </span>
        {container.isManual && (
          <div className="ml-auto flex items-center gap-3">
            <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Manually added
            </span>
            <DeleteContainerButton
              container={container.container}
              variant="button"
              redirectTo="/dispatch"
            />
          </div>
        )}
      </div>

      {/* Dispatch details */}
      <Card>
        <CardContent className="px-6 py-5">
          <h2 className="mb-4 text-sm font-semibold tracking-wider text-muted-foreground">
            DISPATCH
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 lg:grid-cols-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground">
                STATUS
              </span>
              <DispatchStatusSelect
                container={container.container}
                bol={container.bol}
                status={container.status}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground">
                WAREHOUSE
              </span>
              <DispatchAssignmentCell
                container={container.container}
                bol={container.bol}
                field="warehouse"
                value={container.warehouse}
                options={WAREHOUSE_OPTIONS}
                placeholder="Warehouse"
                label="Warehouse"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground">
                VENDOR
              </span>
              <DispatchAssignmentCell
                container={container.container}
                bol={container.bol}
                field="vendor"
                value={container.vendor}
                options={VENDOR_OPTIONS}
                placeholder="Assign"
                label="Vendor"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground">
                LFD
              </span>
              <DispatchDateCell
                container={container.container}
                bol={container.bol}
                field="lfd"
                value={container.lfd}
                label="LFD"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground">
                PLANNED DATE
              </span>
              <DispatchDateCell
                container={container.container}
                bol={container.bol}
                field="planned_pickup_date"
                value={container.planned_pickup_date}
                label="Planned Date"
              />
            </div>
          </div>
          <div className="mt-4 border-t pt-4">
            <ManualTrackingEditor
              container={container.container}
              bol={container.bol}
              atd={container.atd}
              ata={container.ata}
              label="Edit dates"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20 bg-primary/5 py-4">
          <CardContent className="px-4">
            <div className="text-3xl font-bold tabular-nums text-primary">
              {container.skuCount}
            </div>
            <p className="text-sm font-semibold tracking-wider text-muted-foreground">
              SKUs
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5 py-4">
          <CardContent className="px-4">
            <div className="text-3xl font-bold tabular-nums text-primary">
              {container.totalQty.toLocaleString()}
            </div>
            <p className="text-sm font-semibold tracking-wider text-muted-foreground">
              TOTAL QTY
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-5 py-3.5">
            <h2 className="text-base font-semibold text-foreground">
              Container Items ({container.skuCount} SKUs)
            </h2>
          </div>
          <Table className="text-base">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>SKU</TableHead>
                <TableHead>PO</TableHead>
                <TableHead className="text-right">Qty</TableHead>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
