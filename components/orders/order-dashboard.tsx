"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { OrderKPICards } from "./order-kpi-cards"
import { OrderFilterBar } from "./order-filter-bar"
import { OrderTable } from "./order-table"
import type { OrderSummary } from "@/lib/order-data"

interface OrderDashboardProps {
  initialData: OrderSummary[]
}

export function OrderDashboard({ initialData }: OrderDashboardProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [supplierFilter, setSupplierFilter] = useState("all")

  const supplierOptions = useMemo(() => {
    return [...new Set(initialData.map((o) => o.supplier))].sort()
  }, [initialData])

  const filteredData = useMemo(() => {
    return initialData.filter((order) => {
      // Status filter
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false
      }
      // Supplier filter
      if (supplierFilter !== "all" && order.supplier !== supplierFilter) {
        return false
      }
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesPO = order.poNumber.toLowerCase().includes(searchLower)
        const matchesSupplier = order.supplier.toLowerCase().includes(searchLower)
        const matchesCustomer = order.customer.toLowerCase().includes(searchLower)
        if (!matchesPO && !matchesSupplier && !matchesCustomer) {
          return false
        }
      }
      return true
    })
  }, [initialData, statusFilter, supplierFilter, search])

  const counts = useMemo(() => {
    // Counts based on supplier filter only (not status)
    const filtered = initialData.filter(
      (o) => supplierFilter === "all" || o.supplier === supplierFilter
    )
    return {
      all: filtered.length,
      inProgress: filtered.filter((o) => o.status === "In Progress").length,
      completed: filtered.filter((o) => o.status === "Completed").length,
    }
  }, [initialData, supplierFilter])

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Order Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Track purchase orders from placement to delivery
            </p>
          </div>
          <Link
            href="/shipments"
            className="rounded-md border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            View Shipments
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="mb-6">
          <OrderKPICards data={filteredData} />
        </div>

        {/* Filters */}
        <div className="mb-4">
          <OrderFilterBar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            supplierFilter={supplierFilter}
            onSupplierFilterChange={setSupplierFilter}
            supplierOptions={supplierOptions}
            counts={counts}
          />
        </div>

        {/* Table */}
        <OrderTable data={filteredData} />
      </div>
    </main>
  )
}
