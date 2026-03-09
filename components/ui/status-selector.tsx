"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

// Shipment/BOL statuses
export const SHIPMENT_STATUSES = [
  { value: "Booked", label: "Booked" },
  { value: "On Water", label: "On Water" },
  { value: "Customs Cleared", label: "Customs Cleared" },
  { value: "Delivering", label: "Delivering" },
  { value: "Delivered", label: "Delivered" },
  { value: "Closed", label: "Closed" },
] as const

// Order statuses
export const ORDER_STATUSES = [
  { value: "In Progress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
] as const

// Container statuses
export const CONTAINER_STATUSES = [
  { value: "Scheduled", label: "Scheduled" },
  { value: "Delivered", label: "Delivered" },
] as const

interface StatusSelectorProps {
  currentStatus: string
  statuses: readonly { value: string; label: string }[]
  onStatusChange: (status: string) => Promise<void>
  disabled?: boolean
}

export function StatusSelector({
  currentStatus,
  statuses,
  onStatusChange,
  disabled = false,
}: StatusSelectorProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleChange = async (value: string) => {
    if (value === currentStatus) return
    setIsUpdating(true)
    try {
      await onStatusChange(value)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="relative">
      <Select
        value={currentStatus}
        onValueChange={handleChange}
        disabled={disabled || isUpdating}
      >
        <SelectTrigger className="w-[180px]">
          {isUpdating ? (
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span>Updating...</span>
            </div>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent>
          {statuses.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
