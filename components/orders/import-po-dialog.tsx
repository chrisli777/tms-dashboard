"use client"

import { useState, useEffect } from "react"
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
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Upload,
  FileText,
  Folder,
  Search,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Ship,
  Package,
  AlertTriangle,
  LogOut,
} from "lucide-react"
import type { ParsedOrderManagement } from "@/app/api/po/parse/route"

interface OneDriveFile {
  id: string
  name: string
  size: number
  lastModifiedDateTime: string
  webUrl: string
  mimeType?: string
  driveId?: string
  remoteItemId?: string
  remoteItemDriveId?: string
}

interface OneDriveFolder {
  id: string
  name: string
  path: string
  driveId?: string
}

interface AuthStatus {
  authenticated: boolean
  user?: {
    name: string
    email: string
  }
}

type Step = "auth" | "select" | "parsing" | "preview" | "importing" | "done"

export function ImportPODialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("auth")
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [files, setFiles] = useState<OneDriveFile[]>([])
  const [folders, setFolders] = useState<OneDriveFolder[]>([])
  const [folderPath, setFolderPath] = useState<{ id: string; name: string; driveId?: string }[]>([])
  const [selectedFile, setSelectedFile] = useState<OneDriveFile | null>(null)
  const [parsedData, setParsedData] = useState<ParsedOrderManagement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{
    success: boolean
    results: Array<{
      poNumber: string
      action: string
      message: string
    }>
    summary: {
      totalPOs: number
      created: number
      updated: number
      errors: number
    }
  } | null>(null)

  // Check auth status when dialog opens
  useEffect(() => {
    if (open) {
      checkAuthStatus()
    }
  }, [open])

  // Load files when authenticated and folder changes
  useEffect(() => {
    if (open && authStatus?.authenticated) {
      loadFiles()
    }
  }, [open, folderPath, authStatus?.authenticated])

  const checkAuthStatus = async () => {
    setAuthLoading(true)
    try {
      const response = await fetch("/api/auth/microsoft/status")
      const data = await response.json()
      setAuthStatus(data)
      if (data.authenticated) {
        setStep("select")
      } else {
        setStep("auth")
      }
    } catch (err) {
      console.error("Failed to check auth status:", err)
      setStep("auth")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignIn = (forceConsent: boolean = false) => {
    // Redirect to Microsoft login, with optional force consent for new permissions
    const forceParam = forceConsent ? "&force=true" : ""
    window.location.href = `/api/auth/microsoft/login?returnUrl=${encodeURIComponent(window.location.pathname)}${forceParam}`
  }

  const handleSignOut = async () => {
    await fetch("/api/auth/microsoft/logout", { method: "POST" })
    setAuthStatus(null)
    setStep("auth")
  }

  const handleReauthorize = () => {
    // Force re-consent to get updated permissions
    handleSignIn(true)
  }

  const loadFiles = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      
      // If browsing inside a folder
      if (folderPath.length > 0) {
        const currentFolder = folderPath[folderPath.length - 1]
        params.set("folderId", currentFolder.id)
        if (currentFolder.driveId) {
          params.set("driveId", currentFolder.driveId)
        }
      }
      
      if (searchQuery) params.set("query", searchQuery)

      const response = await fetch(`/api/onedrive/files?${params}`)
      const data = await response.json()

      if (!response.ok) {
        // Handle auth error
        if (data.error === "not_authenticated") {
          setAuthStatus({ authenticated: false })
          setStep("auth")
          return
        }
        throw new Error(data.message || data.error || "Failed to load files")
      }

      setFiles(data.files || [])
      setFolders(data.folders || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadFiles()
  }

  const handleFolderClick = (folder: OneDriveFolder) => {
    setFolderPath([...folderPath, { id: folder.id, name: folder.name, driveId: folder.driveId }])
  }

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setFolderPath([])
    } else {
      setFolderPath(folderPath.slice(0, index + 1))
    }
  }

  const getCurrentFolderPath = () => {
    return folderPath.map(f => f.name).join("/")
  }

  const handleFileSelect = async (file: OneDriveFile) => {
    setSelectedFile(file)
    setStep("parsing")
    setError(null)

    try {
      // For shared files, use the proper IDs
      const fileId = file.remoteItemId || file.id
      const driveId = file.remoteItemDriveId || file.driveId

      const response = await fetch("/api/po/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          fileId,
          driveId,
          folderPath: getCurrentFolderPath(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse document")
      }

      setParsedData(data.data)
      setStep("preview")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse document")
      setStep("select")
    }
  }

  const handleImport = async () => {
    if (!parsedData) return

    setStep("importing")
    setError(null)

    try {
      const response = await fetch("/api/po/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsedData }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to import PO")
      }

      setImportResult(data)
      setStep("done")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import PO")
      setStep("preview")
    }
  }

  const handleClose = () => {
    setOpen(false)
    // Reset state after animation
    setTimeout(() => {
      setStep(authStatus?.authenticated ? "select" : "auth")
      setSelectedFile(null)
      setParsedData(null)
      setError(null)
      setImportResult(null)
      setSearchQuery("")
      setFolderPath([])
    }, 300)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  // Group line items by WHI PO for display
  const getGroupedItems = () => {
    if (!parsedData) return []
    const groups = new Map<string, typeof parsedData.lineItems>()
    for (const item of parsedData.lineItems) {
      if (!groups.has(item.whiPo)) {
        groups.set(item.whiPo, [])
      }
      groups.get(item.whiPo)!.push(item)
    }
    return Array.from(groups.entries())
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="size-4" />
          Import PO
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "auth" && "Sign in to OneDrive"}
            {step === "select" && "Import Purchase Order from OneDrive"}
            {step === "parsing" && "Parsing Document with AI..."}
            {step === "preview" && "Review Parsed Order Management Data"}
            {step === "importing" && "Importing PO..."}
            {step === "done" && "Import Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "auth" && "Sign in with your Microsoft account to access shared files."}
            {step === "select" && "Select a PDF or Excel file containing purchase order information."}
            {step === "parsing" && "Using Claude AI to extract and standardize purchase order data."}
            {step === "preview" && "Review the 15-column Order Management data before importing."}
            {step === "importing" && "Saving purchase order to the database."}
            {step === "done" && `Processed ${importResult?.summary.totalPOs || 0} PO(s)`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {error}
          </div>
        )}

        {/* Step 0: Authentication */}
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
                <div className="flex flex-col gap-2">
                  <Button onClick={() => handleSignIn(true)} size="lg" className="gap-2">
                    <svg viewBox="0 0 23 23" className="size-5">
                      <path fill="#f35325" d="M1 1h10v10H1z" />
                      <path fill="#81bc06" d="M12 1h10v10H12z" />
                      <path fill="#05a6f0" d="M1 12h10v10H1z" />
                      <path fill="#ffba08" d="M12 12h10v10H12z" />
                    </svg>
                    Sign in with Microsoft
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    You will be asked to grant access to OneDrive files
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 1: File Selection */}
        {step === "select" && (
          <div className="space-y-4">
            {/* Search */}
            <div className="flex gap-2">
              <Input
                placeholder="Search for PO files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button variant="outline" size="icon" onClick={handleSearch}>
                <Search className="size-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={loadFiles}>
                <RefreshCw className="size-4" />
              </Button>
            </div>

            {/* User info & breadcrumb */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => handleBreadcrumbClick(-1)}
                >
                  Shared with me
                </Button>
              {folderPath.map((folder, index) => (
                <div key={folder.id} className="flex items-center">
                  <ChevronRight className="size-4 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => handleBreadcrumbClick(index)}
                  >
                    {folder.name}
                  </Button>
                </div>
              ))}
              </div>
              {authStatus?.user && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{authStatus.user.email}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleSignOut}>
                    Sign out
                  </Button>
                </div>
              )}
            </div>

            {/* File List */}
            <div className="max-h-[400px] space-y-1 overflow-y-auto rounded-lg border p-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : folders.length === 0 && files.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No PDF or Excel files found. Try searching or navigating to a different folder.
                </div>
              ) : (
                <>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted"
                      onClick={() => handleFolderClick(folder)}
                    >
                      <Folder className="size-5 text-amber-500" />
                      <span className="flex-1 font-medium">{folder.name}</span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </button>
                  ))}
                  {files.map((file) => (
                    <button
                      key={file.id}
                      className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted"
                      onClick={() => handleFileSelect(file)}
                    >
                      <FileText className="size-5 text-blue-500" />
                      <div className="flex-1">
                        <div className="font-medium">{file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)} • {formatDate(file.lastModifiedDateTime)}
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Parsing */}
        {step === "parsing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="size-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Analyzing document with Claude AI...</p>
              <p className="text-sm text-muted-foreground">{selectedFile?.name}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Extracting supplier info, line items, containers, and BOL data
              </p>
            </div>
            <Progress value={33} className="w-48" />
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && parsedData && (
          <div className="space-y-4">
            {/* Summary Card */}
            <Card>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">SUPPLIER</p>
                  <p className="text-lg font-bold text-primary">{parsedData.supplierDetected}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">CUSTOMER</p>
                  <p className="text-lg font-bold">{parsedData.customerDetected}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">INVOICE</p>
                  <p className="font-mono font-medium">{parsedData.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">STATUS</p>
                  <Badge variant={parsedData.bolNumber ? "default" : "secondary"}>
                    {parsedData.bolNumber ? "Has BOL" : "Pending"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* BOL & Container Info */}
            {parsedData.bolNumber && (
              <Card>
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Ship className="size-4 text-primary" />
                    <span className="text-sm font-semibold">Shipment Information</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <span className="text-xs text-muted-foreground">BL No.</span>
                      <p className="font-mono font-medium">{parsedData.bolNumber}</p>
                    </div>
                    {parsedData.vessel && (
                      <div>
                        <span className="text-xs text-muted-foreground">Vessel</span>
                        <p className="font-medium">{parsedData.vessel}</p>
                      </div>
                    )}
                    {parsedData.etd && (
                      <div>
                        <span className="text-xs text-muted-foreground">ETD</span>
                        <p className="font-medium">{parsedData.etd}</p>
                      </div>
                    )}
                    {parsedData.eta && (
                      <div>
                        <span className="text-xs text-muted-foreground">ETA</span>
                        <p className="font-medium">{parsedData.eta}</p>
                      </div>
                    )}
                  </div>
                  {parsedData.containers.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Package className="size-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          CONTAINERS ({parsedData.containers.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {parsedData.containers.map((cont, idx) => (
                          <Badge key={idx} variant="outline" className="font-mono">
                            {cont.number} ({cont.type})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Warnings */}
            {parsedData.warnings.length > 0 && (
              <Card className="border-amber-500/50">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="size-4" />
                    <span className="text-sm font-semibold">Parsing Warnings</span>
                  </div>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {parsedData.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Totals */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {parsedData.totalQty.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Qty</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">
                    ${parsedData.totalAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {parsedData.totalWeight?.toLocaleString() || "-"} kg
                  </p>
                  <p className="text-xs text-muted-foreground">Total Weight</p>
                </CardContent>
              </Card>
            </div>

            {/* Line Items Table - Grouped by PO */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                ORDER MANAGEMENT TABLE ({parsedData.lineItems.length} rows)
              </p>
              <div className="max-h-[250px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>WHI PO</TableHead>
                      <TableHead>Container</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">$/PCS</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">GW(kg)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.lineItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">{item.whiPo}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.container || "-"}
                        </TableCell>
                        <TableCell className="font-mono font-medium">{item.sku}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.qty.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${item.unitPriceUsd.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          ${item.amountUsd.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.gwKg?.toLocaleString() || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "Cleared"
                                ? "default"
                                : item.status === "In Transit"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-xs"
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("select")}>
                <ArrowLeft className="mr-2 size-4" />
                Back
              </Button>
              <Button onClick={handleImport}>
                <Check className="mr-2 size-4" />
                Import {getGroupedItems().length} PO(s)
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="size-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Importing purchase orders...</p>
              <p className="text-sm text-muted-foreground">
                Processing {parsedData?.lineItems.length} line items
              </p>
            </div>
            <Progress value={66} className="w-48" />
          </div>
        )}

        {/* Step 5: Done */}
        {step === "done" && importResult && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-success/10">
                <Check className="size-8 text-success" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">Import Complete</p>
                <p className="text-sm text-muted-foreground">
                  {importResult.summary.created} created, {importResult.summary.updated} updated
                  {importResult.summary.errors > 0 && `, ${importResult.summary.errors} errors`}
                </p>
              </div>
            </div>

            {/* Results list */}
            <div className="space-y-2">
              {importResult.results.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    result.action === "error"
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-success/50 bg-success/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.action === "error" ? (
                      <AlertCircle className="size-4 text-destructive" />
                    ) : (
                      <Check className="size-4 text-success" />
                    )}
                    <span className="font-mono font-medium">PO #{result.poNumber}</span>
                  </div>
                  <Badge
                    variant={result.action === "error" ? "destructive" : "default"}
                    className="text-xs"
                  >
                    {result.action === "created_pending" && "Created (Pending)"}
                    {result.action === "created_with_bol" && "Created (With BOL)"}
                    {result.action === "updated" && "Updated"}
                    {result.action === "error" && "Error"}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
