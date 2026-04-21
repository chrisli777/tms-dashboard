"use client"

import { useState } from "react"
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns"
import { Calendar, ChevronLeft, ChevronRight, Download, Loader2, Package, Search, Warehouse } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface ReceiverItem {
  sku: string
  qty: number
  lotNumber: string
  receivedDate: string
}

interface Receiver {
  receiverId: number
  referenceNum: string
  poNum: string
  arrivalDate: string
  receiveDate: string
  warehouse: string
  supplier: string
  totalQty: number
  skuCount: number
  items: ReceiverItem[]
}

interface ApiResponse {
  success: boolean
  totalReceivers: number
  receivers: Receiver[]
  dateRange: { startDate: string; endDate: string }
  warehouse: string
}

export function WarehouseReceivingDashboard() {
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date())
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all")
  const [selectedReceiverType, setSelectedReceiverType] = useState<string>("normal") // "normal" (Receiving), "1" (NCI)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Get week start (Monday) and end (Sunday)
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 })

  const handlePrevWeek = () => setSelectedWeek(subWeeks(selectedWeek, 1))
  const handleNextWeek = () => setSelectedWeek(addWeeks(selectedWeek, 1))

  const handleFetchData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const startDate = format(weekStart, "yyyy-MM-dd")
      const endDate = format(addWeeks(weekEnd, 0), "yyyy-MM-dd") // Include the end date
      
      // Fetch with receiverType filter, warehouse filter on client side
      const receiverTypeParam = selectedReceiverType !== "all" ? `&receiverType=${selectedReceiverType}` : ""
      const response = await fetch(
        `/api/wms/receivers?startDate=${startDate}&endDate=${endDate}&warehouse=all${receiverTypeParam}`
      )

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const result: ApiResponse = await response.json()
      setData(result)
    } catch (err) {
      setError(String(err))
      console.error("[v0] Fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleRowExpanded = (receiverId: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(receiverId)) {
      newExpanded.delete(receiverId)
    } else {
      newExpanded.add(receiverId)
    }
    setExpandedRows(newExpanded)
  }

  // Get unique suppliers from data
  const suppliers = [...new Set(data?.receivers?.map(r => r.supplier).filter(Boolean) || [])]

  // Filter receivers by warehouse, supplier, and search query
  const filteredReceivers = data?.receivers?.filter(receiver => {
    // Filter by warehouse
    if (selectedWarehouse !== "all") {
      const warehouseName = receiver.warehouse?.toLowerCase() || ""
      if (selectedWarehouse === "kent" && !warehouseName.includes("kent")) return false
      if (selectedWarehouse === "moses" && !warehouseName.includes("moses")) return false
    }
    
    // Filter by supplier
    if (selectedSupplier !== "all" && receiver.supplier !== selectedSupplier) {
      return false
    }
    
    // Filter by search query
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      receiver.referenceNum.toLowerCase().includes(query) ||
      receiver.poNum.toLowerCase().includes(query) ||
      receiver.supplier?.toLowerCase().includes(query) ||
      receiver.items.some(item => item.sku.toLowerCase().includes(query))
    )
  }) || []

  // Group by warehouse for summary (use ALL data, not filtered)
  const allReceivers = data?.receivers || []
  const warehouseSummary = allReceivers.reduce((acc, receiver) => {
    const wh = receiver.warehouse
    if (!acc[wh]) {
      acc[wh] = { count: 0, totalQty: 0, skuCount: 0 }
    }
    acc[wh].count++
    acc[wh].totalQty += receiver.totalQty
    acc[wh].skuCount += receiver.skuCount
    return acc
  }, {} as Record<string, { count: number; totalQty: number; skuCount: number }>)
  
  // Count unique suppliers (from all data)
  const totalSuppliers = new Set(allReceivers.map(r => r.supplier).filter(Boolean)).size

  // Export to CSV
  const handleExport = () => {
    if (!filteredReceivers.length) return

    const rows: string[][] = [
      ["Reference #", "PO #", "Supplier", "Warehouse", "Arrival Date", "SKU", "Qty", "Lot Number"]
    ]

    filteredReceivers.forEach(receiver => {
      receiver.items.forEach(item => {
        rows.push([
          receiver.referenceNum,
          receiver.poNum,
          receiver.supplier || "",
          receiver.warehouse,
          receiver.arrivalDate,
          item.sku,
          String(item.qty),
          item.lotNumber,
        ])
      })
    })

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `warehouse-receiving-${format(weekStart, "yyyy-MM-dd")}-to-${format(weekEnd, "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Filter Bar */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Select Date Range</CardTitle>
          <CardDescription>Choose a week and warehouse to view receiving records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Week Selector */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 rounded-md border px-4 py-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
                </span>
              </div>
              <Button variant="outline" size="icon" onClick={handleNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Receiver Type (NCI) Filter */}
            <Select value={selectedReceiverType} onValueChange={setSelectedReceiverType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Receiving</SelectItem>
                <SelectItem value="1">NCI</SelectItem>
              </SelectContent>
            </Select>

            {/* Fetch Button */}
            <Button onClick={handleFetchData} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Fetch Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <p className="font-medium text-destructive">Error fetching data</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Summary Cards - Always show total (unfiltered) data */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Receivers</p>
                    <p className="text-2xl font-bold">{allReceivers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {Object.entries(warehouseSummary).map(([warehouse, summary]) => (
              <Card key={warehouse}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-blue-100 p-3">
                      <Warehouse className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground capitalize">{warehouse}</p>
                      <p className="text-2xl font-bold">{summary.count}</p>
                      <p className="text-xs text-muted-foreground">
                        {summary.totalQty.toLocaleString()} units
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Supplier Count */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-green-100 p-3">
                    <Package className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Suppliers</p>
                    <p className="text-2xl font-bold">{totalSuppliers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search, Filter and Export */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative w-[300px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search reference #, PO #, SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Warehouse Filter */}
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  <SelectItem value="kent">Kent</SelectItem>
                  <SelectItem value="moses">Moses Lake</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Supplier Filter */}
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.sort().map(supplier => (
                    <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" onClick={handleExport} disabled={!filteredReceivers.length}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {/* Data Table */}
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Reference #</TableHead>
                      <TableHead>PO #</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Arrival Date</TableHead>
                      <TableHead className="text-right">SKUs</TableHead>
                      <TableHead className="text-right">Total Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceivers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                          No receivers found for the selected criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredReceivers.map((receiver) => (
                        <Collapsible
                          key={receiver.receiverId}
                          open={expandedRows.has(receiver.receiverId)}
                          onOpenChange={() => toggleRowExpanded(receiver.receiverId)}
                          asChild
                        >
                          <>
                            <CollapsibleTrigger asChild>
                              <TableRow className="cursor-pointer hover:bg-muted/50">
                                <TableCell>
                                  <ChevronRight
                                    className={`h-4 w-4 transition-transform ${
                                      expandedRows.has(receiver.receiverId) ? "rotate-90" : ""
                                    }`}
                                  />
                                </TableCell>
                                <TableCell className="font-mono font-medium">
                                  {receiver.referenceNum}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {receiver.poNum || "-"}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {receiver.supplier || "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize">
                                    {receiver.warehouse}
                                  </Badge>
                                </TableCell>
                                <TableCell>{receiver.arrivalDate}</TableCell>
                                <TableCell className="text-right">{receiver.skuCount}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {receiver.totalQty.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            </CollapsibleTrigger>
                            <CollapsibleContent asChild>
                              <TableRow className="bg-muted/30">
                                <TableCell colSpan={8} className="p-0">
                                  <div className="px-8 py-4">
                                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                                      Items ({receiver.items.length})
                                    </p>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>SKU</TableHead>
                                          <TableHead className="text-right">Qty</TableHead>
                                          <TableHead>Lot Number</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {receiver.items.map((item, idx) => (
                                          <TableRow key={idx}>
                                            <TableCell className="font-mono">{item.sku}</TableCell>
                                            <TableCell className="text-right">
                                              {item.qty.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                              {item.lotNumber || "-"}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
