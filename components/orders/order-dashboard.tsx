"use client"

import { useState, useMemo } from "react"
import { OrderKPICards } from "./order-kpi-cards"
import { OrderFilterBar } from "./order-filter-bar"
import { OrderTable } from "./order-table"
import { ImportPODialog } from "./import-po-dialog"
import { SyncPODialog } from "./sync-po-dialog"
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
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false
      }
      if (supplierFilter !== "all" && order.supplier !== supplierFilter) {
        return false
      }
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
    const filtered = initialData.filter(
      (o) => supplierFilter === "all" || o.supplier === supplierFilter
    )
    return {
      all: filtered.length,
      pending: filtered.filter((o) => o.status === "Pending").length,
      inProgress: filtered.filter((o) => o.status === "In Progress").length,
      completed: filtered.filter((o) => o.status === "Completed").length,
    }
  }, [initialData, supplierFilter])

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header with Import Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Purchase Orders</h2>
          <p className="text-sm text-muted-foreground">
            Manage and track all purchase orders
          </p>
        </div>
        <div className="flex gap-2">
          <SyncPODialog />
          <ImportPODialog />
        </div>
      </div>

      {/* KPI Cards */}
      <OrderKPICards data={filteredData} />

      {/* Filters */}
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

      {/* Table */}
      <OrderTable data={filteredData} />
    </div>
  )
}
