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
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react"
import { TrackingDateCell } from "./tracking-date-cell"
import { statusLabel } from "@/lib/status"
import type {
  DateCellState,
  ParsedTrackingRecord,
  ParsedContainerRecord,
} from "@/lib/tracking-rules"

type ReportFormat = "hbl" | "container"

interface PreviewRow {
  label: string
  sublabel: string | null
  matchedBy: "HBL" | "MBL" | "Container" | null
  vessel: string | null
  matched: boolean
  containerCount: number
  parsed: ParsedTrackingRecord | ParsedContainerRecord
  before: { etd: DateCellState; eta: DateCellState; status: string | null }
  after: { etd: DateCellState; eta: DateCellState; status: string | null }
}

interface PreviewResponse {
  fileName: string
  format: ReportFormat
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
        body: JSON.stringify({ records, format: preview.format }),
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
      <DialogContent className="overflow-hidden bg-card sm:max-w-[min(96vw,1100px)]">
        <DialogHeader>
          <DialogTitle>Upload Shipment Tracking File</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV departure / arrival notice. The format is
            detected automatically — HBL reports match by House/Master B/L,
            container reports match by container number. You confirm before
            anything is saved.
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
                  Detecting format and extracting tracking dates
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
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium text-foreground">{preview.fileName}</span>
              <span className="shrink-0 text-muted-foreground">
                {preview.matchedCount} of {preview.recordCount}{" "}
                {preview.format === "container" ? "containers" : "HBL"} matched
              </span>
            </div>
            <div className="h-[420px] min-w-0 overflow-auto rounded-md border bg-card">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="sticky top-0 z-10 bg-muted shadow-sm">
                  <tr className="text-left text-xs font-semibold tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">
                      {preview.format === "container" ? "CONTAINER" : "HBL / BOL"}
                    </th>
                    <th className="px-3 py-2 text-center">CTRS</th>
                    {preview.format !== "container" && (
                      <th className="px-3 py-2">ETD / ATD</th>
                    )}
                    <th className="px-3 py-2">ETA / ATA</th>
                    <th className="px-3 py-2">STATUS</th>
                  </tr>
                </thead>
                <tbody className="bg-card">
                  {preview.preview.map((row) => (
                    <tr
                      key={row.label}
                      className={`border-t bg-card ${row.matched ? "" : "opacity-50"}`}
                    >
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5 font-semibold text-foreground">
                          {row.label}
                          {row.matchedBy && (
                            <span className="rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-medium text-emerald-700">
                              by {row.matchedBy}
                            </span>
                          )}
                        </span>
                        {row.sublabel && (
                          <span className="block text-xs text-muted-foreground">MBL: {row.sublabel}</span>
                        )}
                        {!row.matched && (
                          <span className="text-xs text-destructive">
                            {preview.format === "container"
                              ? "No matching container"
                              : "No matching HBL / MBL"}
                          </span>
                        )}
                        {row.vessel && (
                          <span className="block text-xs text-muted-foreground">{row.vessel}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                        {row.containerCount}
                      </td>
                      {preview.format !== "container" && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <TrackingDateCell state={row.before.etd} kind="etd" inline />
                            <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                            <TrackingDateCell state={row.after.etd} kind="etd" inline />
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <TrackingDateCell state={row.before.eta} kind="eta" inline />
                          <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                          <TrackingDateCell state={row.after.eta} kind="eta" inline />
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
            </div>
          </div>
        )}

        {/* Done */}
        {phase === "done" && result && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="size-10 text-emerald-600" />
            <p className="text-sm font-medium text-foreground">
              {preview?.format === "container" ? (
                <>
                  Updated {result.updatedContainers} container
                  {result.updatedContainers === 1 ? "" : "s"}.
                </>
              ) : (
                <>
                  Updated {result.updatedContainers} container
                  {result.updatedContainers === 1 ? "" : "s"} across {result.matchedBols} BOL
                  {result.matchedBols === 1 ? "" : "s"}.
                </>
              )}
            </p>
            {result.unmatched.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {result.unmatched.length}{" "}
                {preview?.format === "container" ? "container" : "HBL"}
                {result.unmatched.length === 1 ? "" : "s"} had no match and were skipped.
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
