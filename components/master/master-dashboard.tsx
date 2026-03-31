"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RefreshCw, Download, TrendingUp, TrendingDown, AlertTriangle, Package, Ship, DollarSign, Percent, Settings } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface MasterData {
  dashboard: {
    totalShipments: number
    totalContainers: number
    totalValue: number
    clearedShipments: number
    inTransitShipments: number
    theoreticalTariff: number
    actualTariff: number
    tariffSavings: number
    tariffSavingsRate: number
  } | null
  logisticsAllocations: Array<{
    id: string
    sku: string
    quantity: number
    weight_kg: number
    weight_share: number
    sea_freight: number
    customs_fee: number
    domestic_freight: number
    total_freight: number
    unit_freight: number
  }>
  tariffAllocations: Array<{
    id: string
    sku: string
    quantity: number
    hts_code: string | null
    theoretical_rate: number
    actual_rate: number
    exw_value: number
    theoretical_tariff: number
    actual_tariff: number
    unit_tariff: number
    savings: number
  }>
  priceVerifications: Array<{
    id: string
    sku: string
    quantity: number
    supplier_invoice_price: number
    supplier_quoted_price: number
    supplier_variance: number
    customer_total_price: number
    margin_per_unit: number
    has_alert: boolean
    alert_message: string | null
  }>
  profitAnalysis: Array<{
    id: string
    sku: string
    quantity: number
    customer_quote_unit: number
    exw_cost: number
    freight_cost: number
    tariff_cost: number
    total_cost_unit: number
    gross_profit_unit: number
    margin_percent: number
    is_provisional: boolean
    status: string
  }>
  orderManagement: Array<Record<string, unknown>>
}

export function MasterDashboard() {
  const [data, setData] = useState<MasterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState("dashboard")

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/master/generate")
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (error) {
      console.error("Failed to fetch master data:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateMaster = async () => {
    setGenerating(true)
    try {
      const res = await fetch("/api/master/generate", { method: "POST" })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (error) {
      console.error("Failed to generate master:", error)
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const dashboard = data?.dashboard

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master Table</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive supply chain analysis with 8 sheets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={generateMaster} disabled={generating}>
            {generating ? (
              <>
                <RefreshCw className="mr-2 size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 size-4" />
                Generate Master
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 8 Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="orders">Order Mgmt</TabsTrigger>
          <TabsTrigger value="logistics">Logistics</TabsTrigger>
          <TabsTrigger value="tariff">Tariff</TabsTrigger>
          <TabsTrigger value="price">Price Check</TabsTrigger>
          <TabsTrigger value="profit">Profit</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>

        {/* Tab 1: Dashboard */}
        <TabsContent value="dashboard" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
                <Ship className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.totalShipments ?? 0}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-success">{dashboard?.clearedShipments ?? 0} cleared</span>
                  <span>|</span>
                  <span className="text-amber-500">{dashboard?.inTransitShipments ?? 0} in transit</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Containers</CardTitle>
                <Package className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.totalContainers ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboard?.totalValue ?? 0)}</div>
              </CardContent>
            </Card>

            <Card className="border-success/20 bg-success/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Tariff Savings</CardTitle>
                <TrendingDown className="size-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {formatCurrency(dashboard?.tariffSavings ?? 0)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {((dashboard?.tariffSavingsRate ?? 0) * 100).toFixed(1)}% savings rate
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tariff Comparison */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Tariff Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Theoretical Tariff</span>
                  <span className="font-semibold">{formatCurrency(dashboard?.theoreticalTariff ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Actual Tariff</span>
                  <span className="font-semibold">{formatCurrency(dashboard?.actualTariff ?? 0)}</span>
                </div>
                <Progress 
                  value={dashboard?.theoreticalTariff ? ((dashboard.actualTariff / dashboard.theoreticalTariff) * 100) : 0} 
                  className="h-3"
                />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-success">
                    {formatCurrency(dashboard?.tariffSavings ?? 0)} saved
                  </span>
                  <span className="text-muted-foreground">
                    {((dashboard?.tariffSavingsRate ?? 0) * 100).toFixed(1)}% reduction
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Order Management */}
        <TabsContent value="orders" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Management (15 Columns)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>WHI PO</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>BOL</TableHead>
                      <TableHead>Vessel</TableHead>
                      <TableHead>ETD</TableHead>
                      <TableHead>ETA</TableHead>
                      <TableHead>Container</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Customer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.orderManagement?.slice(0, 50).map((item, idx) => {
                      const container = item.containers as Record<string, unknown> | null
                      const shipment = container?.shipments as Record<string, unknown> | null
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-mono">{String(item.order_id ?? "-")}</TableCell>
                          <TableCell>{String(shipment?.invoice_number ?? "-")}</TableCell>
                          <TableCell>{String(shipment?.bol ?? "-")}</TableCell>
                          <TableCell>{String(shipment?.vessel ?? "-")}</TableCell>
                          <TableCell>{String(shipment?.etd ?? "-")}</TableCell>
                          <TableCell>{String(shipment?.eta ?? "-")}</TableCell>
                          <TableCell>{String(container?.container_number ?? "-")}</TableCell>
                          <TableCell>{String(container?.container_type ?? "-")}</TableCell>
                          <TableCell className="font-mono">{String(item.sku ?? "-")}</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(item.qty ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(item.weight ?? 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.unit_cost ?? 0))}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.amount ?? 0))}</TableCell>
                          <TableCell>{String(item.supplier ?? shipment?.supplier ?? "-")}</TableCell>
                          <TableCell>{String(item.customer ?? "-")}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {(data?.orderManagement?.length ?? 0) > 50 && (
                <div className="border-t p-4 text-center text-sm text-muted-foreground">
                  Showing 50 of {data?.orderManagement?.length} rows
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Logistics Cost Allocation */}
        <TabsContent value="logistics" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Logistics Cost Allocation (Weight-based)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Weight (kg)</TableHead>
                    <TableHead className="text-right">Weight Share</TableHead>
                    <TableHead className="text-right">Sea Freight</TableHead>
                    <TableHead className="text-right">Customs Fee</TableHead>
                    <TableHead className="text-right">Domestic</TableHead>
                    <TableHead className="text-right">Total Freight</TableHead>
                    <TableHead className="text-right">Unit Freight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.logisticsAllocations?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.sku}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.weight_kg.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{(item.weight_share * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.sea_freight)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.customs_fee)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.domestic_freight)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(item.total_freight)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.unit_freight)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data?.logisticsAllocations || data.logisticsAllocations.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        No logistics allocations. Click "Generate Master" to calculate.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Tariff Allocation */}
        <TabsContent value="tariff" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Tariff Allocation & Savings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>HTS Code</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">EXW Value</TableHead>
                    <TableHead className="text-right">Theo. Rate</TableHead>
                    <TableHead className="text-right">Actual Rate</TableHead>
                    <TableHead className="text-right">Theo. Tariff</TableHead>
                    <TableHead className="text-right">Actual Tariff</TableHead>
                    <TableHead className="text-right">Savings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.tariffAllocations?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.sku}</TableCell>
                      <TableCell>{item.hts_code ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.exw_value)}</TableCell>
                      <TableCell className="text-right tabular-nums">{(item.theoretical_rate * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-right tabular-nums">{(item.actual_rate * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.theoretical_tariff)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.actual_tariff)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-success">
                        {formatCurrency(item.savings)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.tariffAllocations || data.tariffAllocations.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        No tariff allocations. Click "Generate Master" to calculate.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Price Verification */}
        <TabsContent value="price" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Price Verification & Alerts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Invoice Price</TableHead>
                    <TableHead className="text-right">Quoted Price</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Customer Price</TableHead>
                    <TableHead className="text-right">Margin/Unit</TableHead>
                    <TableHead>Alert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.priceVerifications?.map((item) => (
                    <TableRow key={item.id} className={item.has_alert ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono">{item.sku}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.supplier_invoice_price)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.supplier_quoted_price)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${item.supplier_variance !== 0 ? "text-destructive" : ""}`}>
                        {formatCurrency(item.supplier_variance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.customer_total_price)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${item.margin_per_unit < 0 ? "text-destructive" : "text-success"}`}>
                        {formatCurrency(item.margin_per_unit)}
                      </TableCell>
                      <TableCell>
                        {item.has_alert ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="size-3" />
                            {item.alert_message ?? "Alert"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-success">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.priceVerifications || data.priceVerifications.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No price verifications. Click "Generate Master" to calculate.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 6: Profit Analysis */}
        <TabsContent value="profit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profit Analysis by SKU</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Customer Quote</TableHead>
                    <TableHead className="text-right">EXW Cost</TableHead>
                    <TableHead className="text-right">Freight</TableHead>
                    <TableHead className="text-right">Tariff</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.profitAnalysis?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">
                        {item.sku}
                        {item.is_provisional && (
                          <Badge variant="outline" className="ml-2 text-xs">Est.</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.customer_quote_unit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.exw_cost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.freight_cost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.tariff_cost)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(item.total_cost_unit)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${item.gross_profit_unit < 0 ? "text-destructive" : "text-success"}`}>
                        {formatCurrency(item.gross_profit_unit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.margin_percent.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          item.status === "Alert" ? "destructive" : 
                          item.status === "Warning" ? "secondary" : 
                          "outline"
                        }>
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.profitAnalysis || data.profitAnalysis.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                        No profit analysis. Click "Generate Master" to calculate.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 7: Container Details */}
        <TabsContent value="containers" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Container Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Container breakdown view coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 8: Config */}
        <TabsContent value="config" className="mt-6">
          <ConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Config Tab Component
function ConfigTab() {
  const [configs, setConfigs] = useState<{
    tariffs: Array<Record<string, unknown>>
    customerQuotations: Array<Record<string, unknown>>
    supplierQuotations: Array<Record<string, unknown>>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeConfig, setActiveConfig] = useState<"tariffs" | "customer" | "supplier">("tariffs")

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/config")
      const json = await res.json()
      if (json.success) {
        setConfigs(json.data)
      }
    } catch (error) {
      console.error("Failed to fetch configs:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant={activeConfig === "tariffs" ? "default" : "outline"}
          onClick={() => setActiveConfig("tariffs")}
        >
          <Percent className="mr-2 size-4" />
          SKU Tariffs ({configs?.tariffs?.length ?? 0})
        </Button>
        <Button
          variant={activeConfig === "customer" ? "default" : "outline"}
          onClick={() => setActiveConfig("customer")}
        >
          <DollarSign className="mr-2 size-4" />
          Customer Quotes ({configs?.customerQuotations?.length ?? 0})
        </Button>
        <Button
          variant={activeConfig === "supplier" ? "default" : "outline"}
          onClick={() => setActiveConfig("supplier")}
        >
          <Package className="mr-2 size-4" />
          Supplier Quotes ({configs?.supplierQuotations?.length ?? 0})
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {activeConfig === "tariffs" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>HTS Code</TableHead>
                  <TableHead className="text-right">Theoretical Rate</TableHead>
                  <TableHead className="text-right">Actual Rate</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs?.tariffs?.map((t) => (
                  <TableRow key={String(t.id)}>
                    <TableCell className="font-mono">{String(t.sku)}</TableCell>
                    <TableCell>{String(t.hts_code ?? "-")}</TableCell>
                    <TableCell className="text-right tabular-nums">{(Number(t.theoretical_rate) * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{(Number(t.actual_rate) * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-muted-foreground">{String(t.description ?? "-")}</TableCell>
                  </TableRow>
                ))}
                {(!configs?.tariffs || configs.tariffs.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No SKU tariff configurations. Add tariff rates to enable tariff analysis.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {activeConfig === "customer" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quoted Price</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs?.customerQuotations?.map((q) => (
                  <TableRow key={String(q.id)}>
                    <TableCell>{String(q.customer)}</TableCell>
                    <TableCell className="font-mono">{String(q.sku)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(q.quoted_price))}</TableCell>
                    <TableCell>{String(q.effective_date ?? "-")}</TableCell>
                    <TableCell className="text-muted-foreground">{String(q.notes ?? "-")}</TableCell>
                  </TableRow>
                ))}
                {(!configs?.customerQuotations || configs.customerQuotations.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No customer quotations. Add quotes to enable price verification.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {activeConfig === "supplier" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quoted Price</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs?.supplierQuotations?.map((q) => (
                  <TableRow key={String(q.id)}>
                    <TableCell>{String(q.supplier)}</TableCell>
                    <TableCell className="font-mono">{String(q.sku)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(q.quoted_price))}</TableCell>
                    <TableCell>{String(q.effective_date ?? "-")}</TableCell>
                    <TableCell className="text-muted-foreground">{String(q.notes ?? "-")}</TableCell>
                  </TableRow>
                ))}
                {(!configs?.supplierQuotations || configs.supplierQuotations.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No supplier quotations. Add quotes to enable price verification.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
