"use client"

import { useState, useMemo } from "react"
import { bolData } from "@/lib/bol-data"
import { KPICards } from "./kpi-cards"
import { FilterBar } from "./filter-bar"
import { BOLTable } from "./bol-table"
import { Ship } from "lucide-react"

export function BOLDashboard() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [blFilter, setBlFilter] = useState("all")
  const [poFilter, setPoFilter] = useState("all")

  const blOptions = useMemo(
    () => [...new Set(bolData.map((r) => r.blNo))],
    []
  )
  const poOptions = useMemo(
    () => [...new Set(bolData.map((r) => r.whiPo))].sort(),
    []
  )

  const filtered = useMemo(() => {
    return bolData.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (blFilter !== "all" && r.blNo !== blFilter) return false
      if (poFilter !== "all" && r.whiPo !== poFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          r.container.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.invoice.toLowerCase().includes(q) ||
          r.blNo.toLowerCase().includes(q) ||
          r.whiPo.toLowerCase().includes(q) ||
          r.supplier.toLowerCase().includes(q) ||
          r.customer.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [search, statusFilter, blFilter, poFilter])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-6 py-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Ship className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-card-foreground">
              BOL Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Track and manage your Bills of Lading
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="flex flex-col gap-6">
          {/* KPI Cards */}
          <KPICards data={filtered} />

          {/* Filters */}
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            blFilter={blFilter}
            onBlFilterChange={setBlFilter}
            blOptions={blOptions}
            poFilter={poFilter}
            onPoFilterChange={setPoFilter}
            poOptions={poOptions}
          />

          {/* Table */}
          <BOLTable data={filtered} />
        </div>
      </main>
    </div>
  )
}
