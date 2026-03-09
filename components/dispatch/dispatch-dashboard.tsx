"use client"

import { useState, useMemo } from "react"
import { DispatchKPICards } from "./dispatch-kpi-cards"
import { DispatchFilterBar } from "./dispatch-filter-bar"
import { DispatchTable } from "./dispatch-table"
import type { DispatchContainer } from "@/lib/dispatch-data"

interface DispatchDashboardProps {
  initialData: DispatchContainer[]
}

export function DispatchDashboard({ initialData }: DispatchDashboardProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  const typeOptions = useMemo(() => {
    return [...new Set(initialData.map((c) => c.type))].sort()
  }, [initialData])

  const filteredData = useMemo(() => {
    return initialData.filter((container) => {
      if (statusFilter !== "all" && container.status !== statusFilter) {
        return false
      }
      if (typeFilter !== "all" && container.type !== typeFilter) {
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
  }, [initialData, statusFilter, typeFilter, search])

  const counts = useMemo(() => {
    const filtered = initialData.filter(
      (c) => typeFilter === "all" || c.type === typeFilter
    )
    return {
      all: filtered.length,
      inTransit: filtered.filter((c) => c.status === "In Transit").length,
      cleared: filtered.filter((c) => c.status === "Cleared").length,
    }
  }, [initialData, typeFilter])

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* KPI Cards */}
      <DispatchKPICards data={filteredData} />

      {/* Filters */}
      <DispatchFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        typeOptions={typeOptions}
        counts={counts}
      />

      {/* Table */}
      <DispatchTable data={filteredData} />
    </div>
  )
}
