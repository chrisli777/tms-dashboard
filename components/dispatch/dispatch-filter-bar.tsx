"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search } from "lucide-react"

interface DispatchFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  supplierFilter: string
  onSupplierFilterChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  supplierOptions: string[]
  statusOptions: string[]
  count: number
}

export function DispatchFilterBar({
  search,
  onSearchChange,
  supplierFilter,
  onSupplierFilterChange,
  statusFilter,
  onStatusFilterChange,
  supplierOptions,
  statusOptions,
  count,
}: DispatchFilterBarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Heading + count */}
      <div className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
        Arrived &amp; Ready to Dispatch ({count})
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={supplierFilter} onValueChange={onSupplierFilterChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {supplierOptions.map((supplier) => (
              <SelectItem key={supplier} value={supplier}>
                {supplier}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search container, BOL..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-[200px] pl-9"
          />
        </div>
      </div>
    </div>
  )
}
