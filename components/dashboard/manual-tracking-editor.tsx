"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ManualTrackingEditorProps {
  container: string
  bol?: string
  atd: string | null
  ata: string | null
  /** Optional label for the trigger button; defaults to a pencil icon only. */
  label?: string
}

/**
 * Compact editor to manually set a container's actual departure (ATD) and
 * actual arrival (ATA). Writing an ATA marks the container Arrived (and thus
 * eligible for dispatch); clearing both resets it to Pending. Saves through the
 * single controlled write path, then refreshes server data.
 */
export function ManualTrackingEditor({
  container,
  bol,
  atd,
  ata,
  label,
}: ManualTrackingEditorProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [atdValue, setAtdValue] = useState(atd ?? "")
  const [ataValue, setAtaValue] = useState(ata ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-sync local state whenever the popover is opened.
  function handleOpenChange(next: boolean) {
    if (next) {
      setAtdValue(atd ?? "")
      setAtaValue(ata ?? "")
      setError(null)
    }
    setOpen(next)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/shipments/container/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          container,
          bol,
          atd: atdValue || null,
          ata: ataValue || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to save")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil className="size-3" />
          {label && <span>{label}</span>}
          <span className="sr-only">Edit ATD and ATA for {container}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Edit actual dates</h3>
            <p className="text-xs text-muted-foreground">{container}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="atd-input" className="text-xs">
              ATD (actual departure)
            </Label>
            <Input
              id="atd-input"
              type="date"
              value={atdValue}
              onChange={(e) => setAtdValue(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ata-input" className="text-xs">
              ATA (actual arrival)
            </Label>
            <Input
              id="ata-input"
              type="date"
              value={ataValue}
              onChange={(e) => setAtaValue(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
