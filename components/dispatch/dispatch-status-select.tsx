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
import { StatusBadge } from "@/components/ui/status-badge"
import { DISPATCH_STATUS_OPTIONS } from "@/lib/status"
import { useCanEdit } from "@/components/providers/role-provider"

interface DispatchStatusSelectProps {
  container: string
  bol?: string
  /** Current effective status label (Arrived / Cleared / Scheduled / Closed). */
  status: string
}

// The manual dispatch stages are only reachable once a container has Arrived.
const EDITABLE_STATUSES = new Set<string>(DISPATCH_STATUS_OPTIONS)

const DOT_CLASS: Record<string, string> = {
  Arrived: "bg-emerald-500",
  Cleared: "bg-blue-500",
  Available: "bg-cyan-500",
  Scheduled: "bg-teal-500",
  Closed: "bg-slate-500",
}

/**
 * Inline dropdown to set a container's post-arrival dispatch stage. Persists
 * through the controlled write path, then refreshes so the new status is
 * reflected everywhere (Dispatcher, Shipment Tracking, container/BOL detail).
 */
export function DispatchStatusSelect({
  container,
  bol,
  status,
}: DispatchStatusSelectProps) {
  const router = useRouter()
  const canEdit = useCanEdit()
  const [value, setValue] = useState(status)
  const [saving, setSaving] = useState(false)

  // Read-only visitors and not-yet-arrived containers (Pending / In Transit)
  // show the status as a static badge rather than an editable dropdown.
  if (!canEdit || !EDITABLE_STATUSES.has(status)) {
    return <StatusBadge status={value} />
  }

  async function handleChange(next: string) {
    const prev = value
    setValue(next)
    setSaving(true)
    try {
      const res = await fetch("/api/dispatch/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ container, bol, status: next }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      router.refresh()
    } catch {
      setValue(prev)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={value} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger
          size="sm"
          className="h-8 w-[140px] gap-2"
          aria-label={`Dispatch status for ${container}`}
        >
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block size-1.5 rounded-full ${DOT_CLASS[value] ?? "bg-slate-400"}`}
            />
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {DISPATCH_STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
