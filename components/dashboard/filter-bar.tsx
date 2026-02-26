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

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  supplierFilter: string
  onSupplierFilterChange: (value: string) => void
  supplierOptions: string[]
  counts: {
    all: number
    inTransit: number
    cleared: number
  }
}

export function FilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  supplierFilter,
  onSupplierFilterChange,
  supplierOptions,
  counts,
}: FilterBarProps) {
  const tabs = [
    { value: "all", label: "All", count: counts.all },
    { value: "In Transit", label: "In Transit", count: counts.inTransit },
    { value: "Cleared", label: "Cleared", count: counts.cleared },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Status Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onStatusFilterChange(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Select value={supplierFilter} onValueChange={onSupplierFilterChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {supplierOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invoice, BOL, or SKU..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-[240px] pl-9"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
