"use client"

import { useState, useMemo } from "react"
import type { BOLSummary } from "@/lib/bol-data"
import { KPICards } from "./kpi-cards"
import { FilterBar } from "./filter-bar"
import { BOLTable } from "./bol-table"
import { Ship } from "lucide-react"

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
      inTransit: initialData.filter((r) => r.status === "In Transit").length,
      cleared: initialData.filter((r) => r.status === "Cleared").length,
    }),
    [initialData]
  )

  const filtered = useMemo(() => {
    return initialData.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-6 py-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Ship className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-card-foreground">
              Shipment Tracking
            </h1>
            <p className="text-sm text-muted-foreground">
              Track shipments from origin to warehouse delivery
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <div className="flex flex-col gap-6">
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
      </main>
    </div>
  )
}
