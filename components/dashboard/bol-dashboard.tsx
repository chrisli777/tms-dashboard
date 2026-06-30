"use client"

import { useState, useMemo } from "react"
import type { BOLSummary } from "@/lib/bol-data"
import { KPICards } from "./kpi-cards"
import { FilterBar } from "./filter-bar"
import { BOLTable } from "./bol-table"
import { UploadTrackingDialog } from "./upload-tracking-dialog"

interface BOLDashboardProps {
  initialData: BOLSummary[]
}

export function BOLDashboard({ initialData }: BOLDashboardProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [supplierFilter, setSupplierFilter] = useState("all")

  const supplierOptions = useMemo(
    () => [...new Set(initialData.map((r) => r.supplier))].sort(),
    [initialData]
  )

  const counts = useMemo(
    () => ({
      all: initialData.length,
      onWater: initialData.filter((r) => r.status === "On Water").length,
      inTransit: initialData.filter((r) => r.status === "In Transit").length,
      cleared: initialData.filter((r) => r.status === "Arrived").length,
    }),
    [initialData]
  )

  const filtered = useMemo(() => {
    return initialData.filter((r) => {
      // Map filter values to actual status values
      if (statusFilter === "On Water" && r.status !== "On Water") return false
      if (statusFilter === "In Transit" && r.status !== "In Transit") return false
      if (statusFilter === "Arrived" && r.status !== "Arrived") return false
      if (supplierFilter !== "all" && r.supplier !== supplierFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          r.invoice.toLowerCase().includes(q) ||
          r.bol.toLowerCase().includes(q) ||
          r.supplier.toLowerCase().includes(q) ||
          r.pos.some((p) => p.toLowerCase().includes(q)) ||
          r.containers.some((c) =>
            c.container.toLowerCase().includes(q) ||
            c.items.some((i) => i.sku.toLowerCase().includes(q))
          )
        )
      }
      return true
    })
  }, [initialData, search, statusFilter, supplierFilter])

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Shipments</h2>
          <p className="text-sm text-muted-foreground">
            Upload a tracking file to update ETD/ATD &amp; ETA/ATA automatically
          </p>
        </div>
        <UploadTrackingDialog />
      </div>

      <KPICards data={filtered} />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        supplierFilter={supplierFilter}
        onSupplierFilterChange={setSupplierFilter}
        supplierOptions={supplierOptions}
        counts={counts}
      />

      <BOLTable data={filtered} />
    </div>
  )
}
