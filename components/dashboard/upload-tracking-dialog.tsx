"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react"
import { TrackingDateCell } from "./tracking-date-cell"
import { statusLabel } from "@/lib/status"
import type { DateCellState, ParsedTrackingRecord } from "@/lib/tracking-rules"

interface PreviewRow {
  hbl: string
  mbl: string | null
  vessel: string | null
  matched: boolean
  containerCount: number
  parsed: ParsedTrackingRecord
  before: { etd: DateCellState; eta: DateCellState; status: string | null }
  after: { etd: DateCellState; eta: DateCellState; status: string | null }
}

interface PreviewResponse {
  fileName: string
  recordCount: number
  matchedCount: number
  preview: PreviewRow[]
}

type Phase = "idle" | "parsing" | "preview" | "applying" | "done"

export function UploadTrackingDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [result, setResult] = useState<{ matchedBols: number; updatedContainers: number; unmatched: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setPhase("idle")
    setError(null)
    setPreview(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setPhase("parsing")
    setPreview(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/shipments/upload", { method: "POST", body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to parse file")
      setPreview(json as PreviewResponse)
      setPhase("preview")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file")
      setPhase("idle")
    }
  }

  async function handleApply() {
    if (!preview) return
    setPhase("applying")
    setError(null)
    try {
      const records = preview.preview.filter((p) => p.matched).map((p) => p.parsed)
      const res = await fetch("/api/shipments/upload/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to apply updates")
      setResult(json)
      setPhase("done")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply updates")
      setPhase("preview")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Upload className="size-4" />
          Upload Tracking File
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl overflow-hidden bg-card">
        <DialogHeader>
          <DialogTitle>Upload Shipment Tracking File</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV departure / arrival notice. Claude extracts the
            HBL, ETD/ATD and ETA/ATA, then you confirm before anything is saved.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Idle / parsing: file picker */}
        {(phase === "idle" || phase === "parsing") && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={phase === "parsing"}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {phase === "parsing" ? (
              <>
                <Loader2 className="size-8 animate-spin text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Parsing file with Claude…
                </span>
                <span className="text-xs text-muted-foreground">
                  Extracting HBL, ETD/ATD and ETA/ATA
                </span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="size-8 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Click to choose a file
                </span>
                <span className="text-xs text-muted-foreground">
                  .xlsx, .xls or .csv
                </span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              onChange={handleFile}
            />
          </button>
        )}

        {/* Preview */}
        {(phase === "preview" || phase === "applying") && preview && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{preview.fileName}</span>
              <span className="text-muted-foreground">
                {preview.matchedCount} of {preview.recordCount} HBL matched
              </span>
            </div>
            <ScrollArea className="h-[320px] rounded-md border bg-card">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted shadow-sm">
                  <tr className="text-left text-xs font-semibold tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">HBL / BOL</th>
                    <th className="px-3 py-2 text-center">CTRS</th>
                    <th className="px-3 py-2">ETD / ATD</th>
                    <th className="px-3 py-2">ETA / ATA</th>
                    <th className="px-3 py-2">STATUS</th>
                  </tr>
                </thead>
                <tbody className="bg-card">
                  {preview.preview.map((row) => (
                    <tr
                      key={row.hbl}
                      className={`border-t bg-card ${row.matched ? "" : "opacity-50"}`}
                    >
                      <td className="px-3 py-2">
                        <span className="block font-semibold text-foreground">{row.hbl}</span>
                        {row.mbl && (
                          <span className="block text-xs text-muted-foreground">MBL: {row.mbl}</span>
                        )}
                        {!row.matched && (
                          <span className="text-xs text-destructive">No matching HBL</span>
                        )}
                        {row.vessel && (
                          <span className="block text-xs text-muted-foreground">{row.vessel}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                        {row.containerCount}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <TrackingDateCell state={row.before.etd} kind="etd" />
                          <ArrowRight className="size-3 text-muted-foreground" />
                          <TrackingDateCell state={row.after.etd} kind="etd" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <TrackingDateCell state={row.before.eta} kind="eta" />
                          <ArrowRight className="size-3 text-muted-foreground" />
                          <TrackingDateCell state={row.after.eta} kind="eta" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground">
                            {statusLabel(row.before.status)}
                          </span>
                          <ArrowRight className="size-3 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            {statusLabel(row.after.status)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* Done */}
        {phase === "done" && result && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="size-10 text-emerald-600" />
            <p className="text-sm font-medium text-foreground">
              Updated {result.updatedContainers} container
              {result.updatedContainers === 1 ? "" : "s"} across {result.matchedBols} BOL
              {result.matchedBols === 1 ? "" : "s"}.
            </p>
            {result.unmatched.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {result.unmatched.length} HBL had no matching BOL and were skipped.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>
                Choose another file
              </Button>
              <Button onClick={handleApply} disabled={preview?.matchedCount === 0}>
                Apply {preview?.matchedCount ?? 0} update
                {preview?.matchedCount === 1 ? "" : "s"}
              </Button>
            </>
          )}
          {phase === "applying" && (
            <Button disabled className="gap-2">
              <Loader2 className="size-4 animate-spin" />
              Applying…
            </Button>
          )}
          {phase === "done" && <Button onClick={() => handleOpenChange(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
