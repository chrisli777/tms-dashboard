"use client"

import { useState, useMemo } from "react"
import { DispatchKPICards } from "./dispatch-kpi-cards"
import { DispatchFilterBar } from "./dispatch-filter-bar"
import { DispatchTable, type SortKey, type SortDir } from "./dispatch-table"
import { getStatusStep } from "@/lib/status"
import type { DispatchContainer } from "@/lib/dispatch-data"

interface DispatchDashboardProps {
  initialData: DispatchContainer[]
}

export function DispatchDashboard({ initialData }: DispatchDashboardProps) {
  const [search, setSearch] = useState("")
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const supplierOptions = useMemo(() => {
    return [...new Set(initialData.map((c) => c.supplier).filter(Boolean))].sort()
  }, [initialData])

  const statusOptions = useMemo(() => {
    return [...new Set(initialData.map((c) => c.status).filter(Boolean))].sort(
      (a, b) => getStatusStep(a) - getStatusStep(b)
    )
  }, [initialData])

  const filteredData = useMemo(() => {
    return initialData.filter((container) => {
      if (supplierFilter !== "all" && container.supplier !== supplierFilter) {
        return false
      }
      if (statusFilter !== "all" && container.status !== statusFilter) {
        return false
      }
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesContainer = container.container.toLowerCase().includes(searchLower)
        const matchesBOL = container.bol.toLowerCase().includes(searchLower)
        const matchesSupplier = container.supplier.toLowerCase().includes(searchLower)
        if (!matchesContainer && !matchesBOL && !matchesSupplier) {
          return false
        }
      }
      return true
    })
  }, [initialData, supplierFilter, statusFilter, search])

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData
    const arr = [...filteredData]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortKey === "supplier") {
        cmp = a.supplier.localeCompare(b.supplier)
      } else if (sortKey === "status") {
        cmp = getStatusStep(a.status) - getStatusStep(b.status)
      } else {
        // atd / ata date columns: empty dates sort last.
        const av = a[sortKey] ? new Date(a[sortKey] as string).getTime() : Number.POSITIVE_INFINITY
        const bv = b[sortKey] ? new Date(b[sortKey] as string).getTime() : Number.POSITIVE_INFINITY
        cmp = av - bv
      }
      return sortDir === "asc" ? cmp : -cmp
    })
    return arr
  }, [filteredData, sortKey, sortDir])

  function handleSort(key: SortKey) {
    // Single-column sort with a three-state cycle:
    // asc -> desc -> default (unsorted). Clicking a different column starts at asc.
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc")
      } else {
        // Was descending: third click clears the sort back to default order.
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
      {/* KPI Cards */}
      <DispatchKPICards data={filteredData} />

      {/* Filters */}
      <DispatchFilterBar
        search={search}
        onSearchChange={setSearch}
        supplierFilter={supplierFilter}
        onSupplierFilterChange={setSupplierFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        supplierOptions={supplierOptions}
        statusOptions={statusOptions}
        count={filteredData.length}
      />

      {/* Table */}
      <DispatchTable
        data={sortedData}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />
    </div>
  )
}
