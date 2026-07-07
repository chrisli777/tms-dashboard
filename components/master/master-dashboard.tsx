"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { Package, Ship, DollarSign, Percent, Clock } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { MasterData } from "@/lib/master-data"

interface MasterDashboardProps {
  data: MasterData
}

/** Placeholder shown on analysis sheets the Python backend has not yet persisted. */
function PendingBackend({ sheet }: { sheet: string }) {
  return (
    <TableRow>
      <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
        <Clock className="mx-auto mb-2 size-5 opacity-60" />
        {sheet} is calculated by the backend and will appear here once available.
      </TableCell>
    </TableRow>
  )
}

export function MasterDashboard({ data }: MasterDashboardProps) {
  const [activeTab, setActiveTab] = useState("dashboard")
  const { dashboard, orderManagement, tariffRates, priceQuotes } = data

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master Table</h1>
          <p className="text-sm text-muted-foreground">
            Read-only supply chain analysis sourced from the order management backend
          </p>
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
                <CardTitle className="text-sm font-medium">Total Line Items</CardTitle>
                <Ship className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.totalRows.toLocaleString()}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-success">{dashboard.clearedShipments} cleared</span>
                  <span>|</span>
                  <span className="text-amber-500">{dashboard.inTransitShipments} in transit</span>
                  <span>|</span>
                  <span className="text-blue-500">{dashboard.onWaterShipments} on water</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Containers</CardTitle>
                <Package className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.totalContainers.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboard.totalValue)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
                <Package className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.totalQty.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Order Management */}
        <TabsContent value="orders" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Management ({orderManagement.length} rows)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>WHI PO</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>BOL</TableHead>
                      <TableHead>Container</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Weight (kg)</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>ETD</TableHead>
                      <TableHead>ETA</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderManagement.slice(0, 100).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono">{item.whi_po || "-"}</TableCell>
                        <TableCell>{item.invoice || "-"}</TableCell>
                        <TableCell>{item.bl_no || "-"}</TableCell>
                        <TableCell>{item.container || "-"}</TableCell>
                        <TableCell>{item.type || "-"}</TableCell>
                        <TableCell className="font-mono">{item.sku || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(item.qty ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(item.gw_kg ?? 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.unit_price_usd ?? 0))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.amount_usd ?? 0))}</TableCell>
                        <TableCell>{item.etd ?? "-"}</TableCell>
                        <TableCell>{item.eta ?? "-"}</TableCell>
                        <TableCell>{item.supplier || "-"}</TableCell>
                        <TableCell>{item.customer || "-"}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                      </TableRow>
                    ))}
                    {orderManagement.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={15} className="py-8 text-center text-muted-foreground">
                          No order data available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {orderManagement.length > 100 && (
                <div className="border-t p-4 text-center text-sm text-muted-foreground">
                  Showing 100 of {orderManagement.length} rows
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Logistics Cost Allocation (backend-computed) */}
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
                    <TableHead className="text-right">Sea Freight</TableHead>
                    <TableHead className="text-right">Total Freight</TableHead>
                    <TableHead className="text-right">Unit Freight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <PendingBackend sheet="Logistics cost allocation" />
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Tariff Allocation (backend-computed) */}
        <TabsContent value="tariff" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Tariff Allocation &amp; Savings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>HTS Code</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Theo. Tariff</TableHead>
                    <TableHead className="text-right">Actual Tariff</TableHead>
                    <TableHead className="text-right">Savings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <PendingBackend sheet="Tariff allocation" />
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Price Verification (backend-computed) */}
        <TabsContent value="price" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Price Verification &amp; Alerts</CardTitle>
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
                    <TableHead>Alert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <PendingBackend sheet="Price verification" />
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 6: Profit Analysis (backend-computed) */}
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
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <PendingBackend sheet="Profit analysis" />
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
              <p className="text-muted-foreground">
                Container-level breakdown is available on the Dispatch and Shipments pages.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 8: Config */}
        <TabsContent value="config" className="mt-6">
          <ConfigTab tariffRates={tariffRates} priceQuotes={priceQuotes} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Config Tab Component (read-only)
function ConfigTab({
  tariffRates,
  priceQuotes,
}: {
  tariffRates: MasterData["tariffRates"]
  priceQuotes: MasterData["priceQuotes"]
}) {
  const [activeConfig, setActiveConfig] = useState<"tariffs" | "quotes">("tariffs")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant={activeConfig === "tariffs" ? "default" : "outline"}
          onClick={() => setActiveConfig("tariffs")}
        >
          <Percent className="mr-2 size-4" />
          Tariff Rates ({tariffRates.length})
        </Button>
        <Button
          variant={activeConfig === "quotes" ? "default" : "outline"}
          onClick={() => setActiveConfig("quotes")}
        >
          <DollarSign className="mr-2 size-4" />
          Price Quotes ({priceQuotes.length})
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {activeConfig === "tariffs" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Effective Month</TableHead>
                  <TableHead className="text-right">Rate %</TableHead>
                  <TableHead className="text-right">Amount (USD)</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tariffRates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono">{t.sku || "-"}</TableCell>
                    <TableCell>{t.supplier ?? "-"}</TableCell>
                    <TableCell>{t.effective_month ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.tariff_rate_pct != null ? `${t.tariff_rate_pct.toFixed(1)}%` : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.tariff_amount_usd != null ? formatCurrency(t.tariff_amount_usd) : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.notes ?? "-"}</TableCell>
                  </TableRow>
                ))}
                {tariffRates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No tariff rates configured.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {activeConfig === "quotes" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Quarter</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Effective Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceQuotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      {q.quote_type ? <Badge variant="outline">{q.quote_type}</Badge> : "-"}
                    </TableCell>
                    <TableCell className="font-mono">{q.sku || "-"}</TableCell>
                    <TableCell>{q.supplier ?? "-"}</TableCell>
                    <TableCell>{q.quarter ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {q.price != null ? formatCurrency(q.price) : "-"}
                    </TableCell>
                    <TableCell>{q.effective_date ?? "-"}</TableCell>
                  </TableRow>
                ))}
                {priceQuotes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No price quotes configured.
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
