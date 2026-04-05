"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  FileText,
  Plus,
  ArrowRight,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface MasterRow {
  whiPo: string
  supplierInvoice: string
  supplier: string
  customer: string
  containerNo: string
  containerType: string
  blNo: string
  vessel: string
  sku: string
  description: string
  qty: number
  unitPrice: number
  amount: number
  etd: string
  eta: string
}

interface SyncResult {
  newRows: MasterRow[]
  filesProcessed: string[]
  summary: {
    totalFiles: number
    totalNewRows: number
    suppliers: string[]
  }
}

type Step = "auth" | "idle" | "syncing" | "preview" | "confirming" | "done"

interface AuthStatus {
  authenticated: boolean
  user?: { name: string; email: string }
}

export function SyncPODialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("auth")
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("")
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>("")

  // Check auth when dialog opens
  const checkAuth = async () => {
    setAuthLoading(true)
    try {
      const response = await fetch("/api/auth/microsoft/status")
      const data = await response.json()
      setAuthStatus(data)
      setStep(data.authenticated ? "idle" : "auth")
    } catch {
      setStep("auth")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignIn = () => {
    window.location.href = `/api/auth/microsoft/login?returnUrl=${encodeURIComponent(window.location.pathname)}`
  }

  // Check auth when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      checkAuth()
    }
  }

  const handleSync = async () => {
    setStep("syncing")
    setError(null)
    setDebugInfo("")
    setProgress(5)
    setProgressMessage("Starting sync...")

    try {
      const response = await fetch("/api/po/sync", {
        method: "POST",
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`API error: ${text}`)
      }

      // Handle Server-Sent Events stream
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""

        for (const chunk of lines) {
          const eventMatch = chunk.match(/event: (\w+)\ndata: (.+)/)
          if (!eventMatch) continue

          const [, event, dataStr] = eventMatch
          const data = JSON.parse(dataStr)

          if (event === "progress") {
            setProgress(data.percent || 0)
            setProgressMessage(data.message || "Processing...")
            if (data.filesFound) {
              setDebugInfo(`Found files: ${data.filesFound.join(", ")}`)
            }
          } else if (event === "complete") {
            setSyncResult(data)
            setStep("preview")
          } else if (event === "error") {
            if (data.error === "not_authenticated") {
              window.location.href = `/api/auth/microsoft/login?returnUrl=${encodeURIComponent(window.location.pathname)}`
              return
            }
            throw new Error(data.message || data.error || "Sync failed")
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed")
      setStep("idle")
    }
  }

  const handleConfirm = async () => {
    if (!syncResult) return

    setStep("confirming")
    setError(null)

    try {
      const response = await fetch("/api/po/sync/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: syncResult.newRows }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save")
      }

      setStep("done")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
      setStep("preview")
    }
  }

  const handleClose = () => {
    setOpen(false)
    setTimeout(() => {
      setStep(authStatus?.authenticated ? "idle" : "auth")
      setSyncResult(null)
      setError(null)
      setProgress(0)
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="size-4" />
          Update PO
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-none !w-auto !h-auto p-0 overflow-visible">
        <div 
          className="flex flex-col overflow-auto rounded-lg bg-background p-6"
          style={{ 
            resize: "both",
            width: "85vw",
            height: "80vh",
            minWidth: "600px",
            minHeight: "400px",
            maxWidth: "95vw",
            maxHeight: "90vh",
          }}
        >
        <DialogHeader>
          <DialogTitle>
            {step === "auth" && "Sign in to OneDrive"}
            {step === "idle" && "Update Purchase Orders"}
            {step === "syncing" && "Syncing with OneDrive..."}
            {step === "preview" && "Review New Data"}
            {step === "confirming" && "Saving..."}
            {step === "done" && "Sync Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "auth" && "Sign in with your Microsoft account to access shared files."}
            {step === "idle" && "Scan OneDrive shared files and update the master table with new data."}
            {step === "syncing" && "Claude is processing your files..."}
            {step === "preview" && `Found ${syncResult?.summary.totalNewRows || 0} new rows from ${syncResult?.summary.totalFiles || 0} files`}
            {step === "confirming" && "Saving to database..."}
            {step === "done" && "All data has been synced successfully."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Auth State */}
        {step === "auth" && (
          <div className="flex flex-col items-center gap-6 py-8">
            {authLoading ? (
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                  <svg viewBox="0 0 23 23" className="size-10">
                    <path fill="#f35325" d="M1 1h10v10H1z" />
                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">Connect to OneDrive</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sign in with your Microsoft account to access shared files
                  </p>
                </div>
                <Button onClick={handleSignIn} size="lg" className="gap-2">
                  <svg viewBox="0 0 23 23" className="size-5">
                    <path fill="#f35325" d="M1 1h10v10H1z" />
                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                  </svg>
                  Sign in with Microsoft
                </Button>
              </>
            )}
          </div>
        )}

        {/* Idle State */}
        {step === "idle" && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <RefreshCw className="size-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Ready to Sync</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Claude will read all files from OneDrive shared folder,
                <br />
                process them using <code className="rounded bg-muted px-1">scm-file-processor</code> skill,
                <br />
                and generate the master table using <code className="rounded bg-muted px-1">scm-master-generator</code> skill.
              </p>
            </div>
            <Button onClick={handleSync} size="lg" className="gap-2">
              <RefreshCw className="size-4" />
              Start Sync
            </Button>
          </div>
        )}

        {/* Syncing State */}
        {step === "syncing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="size-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">{progressMessage}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This may take a few minutes...
              </p>
            </div>
            <Progress value={progress} className="w-64" />
          </div>
        )}

        {/* Preview State */}
        {step === "preview" && syncResult && (
          <div className="flex flex-col gap-4">
            {/* Summary */}
            <div className="flex items-center gap-4 rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-muted-foreground" />
                <span className="font-medium">{syncResult.summary.totalFiles} files processed</span>
              </div>
              <div className="flex items-center gap-2">
                <Plus className="size-5 text-green-500" />
                <span className="font-medium text-green-600">{syncResult.summary.totalNewRows} new rows</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {syncResult.summary.suppliers.map((supplier) => (
                  <Badge key={supplier} variant="outline">{supplier}</Badge>
                ))}
              </div>
            </div>

            {/* Files processed */}
            {syncResult.filesProcessed.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Files: {syncResult.filesProcessed.join(", ")}
              </div>
            )}

            {/* New rows table - horizontally scrollable */}
            {syncResult.newRows.length > 0 ? (
              <div className="flex-1 min-h-0 rounded-lg border overflow-auto">
                <Table className="min-w-[1200px]">
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[100px] whitespace-nowrap">WHI PO</TableHead>
                      <TableHead className="whitespace-nowrap">Invoice</TableHead>
                      <TableHead className="whitespace-nowrap">Supplier</TableHead>
                      <TableHead className="whitespace-nowrap">Customer</TableHead>
                      <TableHead className="whitespace-nowrap">Container</TableHead>
                      <TableHead className="whitespace-nowrap">Type</TableHead>
                      <TableHead className="whitespace-nowrap">BL No.</TableHead>
                      <TableHead className="whitespace-nowrap">SKU</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Qty</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Unit Price</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
                      <TableHead className="whitespace-nowrap">ETD</TableHead>
                      <TableHead className="whitespace-nowrap">ETA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncResult.newRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">{row.whiPo}</TableCell>
                        <TableCell className="font-mono text-sm">{row.supplierInvoice}</TableCell>
                        <TableCell>{row.supplier}</TableCell>
                        <TableCell>{row.customer}</TableCell>
                        <TableCell className="font-mono text-sm">{row.containerNo || "-"}</TableCell>
                        <TableCell>{row.containerType || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">{row.blNo || "-"}</TableCell>
                        <TableCell>{row.sku}</TableCell>
                        <TableCell className="text-right">{row.qty?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-right">${row.unitPrice?.toFixed(2) || "0.00"}</TableCell>
                        <TableCell className="text-right">${row.amount?.toLocaleString() || 0}</TableCell>
                        <TableCell>{row.etd || "-"}</TableCell>
                        <TableCell>{row.eta || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Check className="size-8" />
                <p>No new data to add. Master table is up to date.</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {syncResult.newRows.length > 0 && (
                <Button onClick={handleConfirm} className="gap-2">
                  <Check className="size-4" />
                  Confirm & Save
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Confirming State */}
        {step === "confirming" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="size-12 animate-spin text-primary" />
            <p className="font-medium">Saving to database...</p>
          </div>
        )}

        {/* Done State */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-100">
              <Check className="size-8 text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Sync Complete!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {syncResult?.summary.totalNewRows} new rows have been added to the master table.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={() => router.push("/master")} className="gap-2">
                View Master Table
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
