"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarRange } from "lucide-react"

/** A single {from,to} inclusive date range (YYYY-MM-DD strings, "" = open). */
export interface DateRange {
  from: string
  to: string
}

/** Map of field key -> range. Keys correspond to the columns being filtered. */
export type DateFilters = Record<string, DateRange>

export interface DateFilterField {
  /** Field key, e.g. "atd". Must match the keys used by the parent filter. */
  key: string
  /** Column label shown in the popover, e.g. "ATD". */
  label: string
}

interface DateRangeFilterProps {
  fields: DateFilterField[]
  value: DateFilters
  onApply: (value: DateFilters) => void
}

const EMPTY_RANGE: DateRange = { from: "", to: "" }

/** Count how many fields have at least one bound set. */
export function countActiveDateFilters(value: DateFilters): number {
  return Object.values(value).filter((r) => r && (r.from || r.to)).length
}

/**
 * A top-right date range filter. Renders a popover with a from/to pair for each
 * configured date field, letting the user constrain several date columns at once
 * and commit them together with "Apply filter".
 */
export function DateRangeFilter({ fields, value, onApply }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateFilters>(value)

  const activeCount = countActiveDateFilters(value)

  // Sync the draft with the committed value whenever the popover is opened so it
  // always reflects the currently applied filters.
  function handleOpenChange(next: boolean) {
    if (next) setDraft(value)
    setOpen(next)
  }

  function setBound(key: string, bound: "from" | "to", v: string) {
    setDraft((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? EMPTY_RANGE), [bound]: v },
    }))
  }

  function apply() {
    onApply(draft)
    setOpen(false)
  }

  function clearAll() {
    const cleared: DateFilters = {}
    for (const f of fields) cleared[f.key] = { ...EMPTY_RANGE }
    setDraft(cleared)
    onApply(cleared)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarRange className="h-4 w-4" />
          Date Filter
          {activeCount > 0 && (
            <Badge className="ml-1 h-5 min-w-5 justify-center px-1.5 tabular-nums">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-4">
          <div className="text-sm font-medium">Filter by date range</div>
          {fields.map((field) => {
            const range = draft[field.key] ?? EMPTY_RANGE
            return (
              <div key={field.key} className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    aria-label={`${field.label} from`}
                    value={range.from}
                    onChange={(e) => setBound(field.key, "from", e.target.value)}
                    className="h-9"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    aria-label={`${field.label} to`}
                    value={range.to}
                    onChange={(e) => setBound(field.key, "to", e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            )
          })}
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear
            </Button>
            <Button size="sm" onClick={apply}>
              Apply filter
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Test whether a date value (YYYY-MM-DD or null) falls within the given range.
 * An empty bound is treated as open-ended. A null value fails any active range.
 */
export function matchesDateRange(value: string | null, range?: DateRange): boolean {
  if (!range || (!range.from && !range.to)) return true
  if (!value) return false
  const v = value.slice(0, 10)
  if (range.from && v < range.from) return false
  if (range.to && v > range.to) return false
  return true
}

/** True if a record passes every active date-range filter. */
export function matchesAllDateFilters(
  filters: DateFilters,
  getValue: (key: string) => string | null,
): boolean {
  for (const [key, range] of Object.entries(filters)) {
    if (!matchesDateRange(getValue(key), range)) return false
  }
  return true
}
