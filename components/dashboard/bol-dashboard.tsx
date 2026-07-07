"use client"

import { useState, useMemo } from "react"
import type { BOLSummary } from "@/lib/bol-data"
import { KPICards } from "./kpi-cards"
import { FilterBar } from "./filter-bar"
import { BOLTable, type SortKey, type SortDir } from "./bol-table"
import { UploadTrackingDialog } from "./upload-tracking-dialog"
import { getStatusStep } from "@/lib/status"
import {
  type DateFilters,
  type DateFilterField,
  matchesAllDateFilters,
} from "@/components/shared/date-range-filter"

interface BOLDashboardProps {
  initialData: BOLSummary[]
}

// Shipment Tracking exposes all four planned/actual dates.
const TRACKING_DATE_FIELDS: DateFilterField[] = [
  { key: "etd", label: "ETD" },
  { key: "atd", label: "ATD" },
  { key: "eta", label: "ETA" },
  { key: "ata", label: "ATA" },
]

/** Underlying date used for filtering/sorting each date column of a BOL row. */
function bolDateValue(row: BOLSummary, key: string): string | null {
  switch (key) {
    case "etd":
      return row.etd_original ?? row.etd ?? null
    case "atd":
      return row.atd
    case "eta":
      return row.eta_original ?? row.eta ?? null
    case "ata":
      return row.ata
    default:
      return null
  }
}

export function BOLDashboard({ initialData }: BOLDashboardProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [dateFilters, setDateFilters] = useState<DateFilters>({})
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const supplierOptions = useMemo(
    () => [...new Set(initialData.map((r) => r.supplier))].sort(),
    [initialData]
  )

  const counts = useMemo(
    () => ({
      all: initialData.length,
      pending: initialData.filter((r) => r.status === "Pending").length,
      inTransit: initialData.filter((r) => r.status === "In Transit").length,
      arrived: initialData.filter((r) => r.status === "Arrived").length,
    }),
    [initialData]
  )

  const filtered = useMemo(() => {
    return initialData.filter((r) => {
      // Map filter values to actual status values
      if (statusFilter === "Pending" && r.status !== "Pending") return false
      if (statusFilter === "In Transit" && r.status !== "In Transit") return false
      if (statusFilter === "Arrived" && r.status !== "Arrived") return false
      if (supplierFilter !== "all" && r.supplier !== supplierFilter) return false
      if (!matchesAllDateFilters(dateFilters, (key) => bolDateValue(r, key))) return false
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
  }, [initialData, search, statusFilter, supplierFilter, dateFilters])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const arr = [...filtered]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortKey === "supplier") {
        cmp = a.supplier.localeCompare(b.supplier)
      } else if (sortKey === "status") {
        cmp = getStatusStep(a.status) - getStatusStep(b.status)
      } else {
        // Date columns: empty dates sort last regardless of direction toggle.
        const av = bolDateValue(a, sortKey)
        const bv = bolDateValue(b, sortKey)
        const at = av ? new Date(av + "T00:00:00").getTime() : Number.POSITIVE_INFINITY
        const bt = bv ? new Date(bv + "T00:00:00").getTime() : Number.POSITIVE_INFINITY
        cmp = at - bt
      }
      return sortDir === "asc" ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, sortDir])

  function handleSort(key: SortKey) {
    // Single-column, three-state cycle: asc -> desc -> default (unsorted).
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc")
      } else {
        setSortKey(null)
        setSortDir("asc")
      }
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

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
        dateFields={TRACKING_DATE_FIELDS}
        dateFilters={dateFilters}
        onDateFiltersApply={setDateFilters}
        counts={counts}
      />

      <BOLTable
        data={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />
    </div>
  )
}
