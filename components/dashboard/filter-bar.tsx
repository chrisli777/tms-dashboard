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
  blFilter: string
  onBlFilterChange: (value: string) => void
  blOptions: string[]
  poFilter: string
  onPoFilterChange: (value: string) => void
  poOptions: string[]
}

export function FilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  blFilter,
  onBlFilterChange,
  blOptions,
  poFilter,
  onPoFilterChange,
  poOptions,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by container, SKU, invoice..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Cleared">Cleared</SelectItem>
            <SelectItem value="In Transit">In Transit</SelectItem>
          </SelectContent>
        </Select>

        <Select value={blFilter} onValueChange={onBlFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="BL No." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All BL No.</SelectItem>
            {blOptions.map((bl) => (
              <SelectItem key={bl} value={bl}>
                {"..." + bl.slice(-8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={poFilter} onValueChange={onPoFilterChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="WHI PO" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All PO</SelectItem>
            {poOptions.map((po) => (
              <SelectItem key={po} value={po}>
                {po}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
