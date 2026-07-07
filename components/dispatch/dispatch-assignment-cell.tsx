"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DispatchAssignmentCellProps {
  container: string
  bol?: string
  /** Which assignment column this cell edits. */
  field: "warehouse" | "vendor"
  /** Current value or null. */
  value: string | null
  /** Selectable options. */
  options: readonly string[]
  /** Placeholder shown when unset. */
  placeholder: string
  /** Accessible label, e.g. "Warehouse". */
  label: string
}

/**
 * Inline editable dropdown for the Dispatcher's manual assignment columns
 * (warehouse / vendor). Persists to /api/dispatch/assignment then refreshes.
 */
export function DispatchAssignmentCell({
  container,
  bol,
  field,
  value,
  options,
  placeholder,
  label,
}: DispatchAssignmentCellProps) {
  const router = useRouter()
  const [current, setCurrent] = useState(value ?? "")
  const [saving, setSaving] = useState(false)

  async function handleChange(next: string) {
    const prev = current
    setCurrent(next)
    setSaving(true)
    try {
      const res = await fetch("/api/dispatch/assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ container, bol, field, value: next }),
      })
      if (!res.ok) throw new Error("Failed to update assignment")
      router.refresh()
    } catch {
      setCurrent(prev)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={current} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger
          size="sm"
          className="h-8 w-[150px]"
          aria-label={`${label} for ${container}`}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
