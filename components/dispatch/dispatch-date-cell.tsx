"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarPlus, Pencil } from "lucide-react"

interface DispatchDateCellProps {
  container: string
  bol?: string
  /** Which shipment_containers date column this cell edits. */
  field: "lfd" | "planned_pickup_date"
  /** Current value (YYYY-MM-DD) or null. */
  value: string | null
  /** Accessible label for the field, e.g. "LFD". */
  label: string
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  // Parse as local midnight to avoid a UTC day-shift / hydration mismatch.
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Inline editable date cell for the Dispatcher table. Shows the current date (or
 * an "add" affordance) and opens a small popover with a native date input to set
 * or clear the value. Persists to /api/dispatch/dates then refreshes.
 */
export function DispatchDateCell({
  container,
  bol,
  field,
  value,
  label,
}: DispatchDateCellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const [saving, setSaving] = useState(false)

  function handleOpenChange(next: boolean) {
    if (next) setDraft(value ?? "")
    setOpen(next)
  }

  async function save(nextValue: string | null) {
    setSaving(true)
    try {
      const res = await fetch("/api/dispatch/dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ container, bol, field, value: nextValue }),
      })
      if (!res.ok) throw new Error("Failed to update date")
      setOpen(false)
      router.refresh()
    } catch {
      // Keep the popover open so the user can retry.
    } finally {
      setSaving(false)
    }
  }

  const formatted = formatDate(value)

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Edit ${label} for ${container}`}
            className="group/date inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted"
          >
            {formatted ? (
              <>
                <span className="tabular-nums text-foreground">{formatted}</span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover/date:opacity-100" />
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <CalendarPlus className="h-3.5 w-3.5" />
                Set
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56">
          <div className="flex flex-col gap-3">
            <div className="text-sm font-medium">{label}</div>
            <Input
              type="date"
              aria-label={label}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-9"
            />
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                disabled={saving || !value}
                onClick={() => save(null)}
              >
                Clear
              </Button>
              <Button size="sm" disabled={saving} onClick={() => save(draft || null)}>
                Save
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
