import { NextRequest, NextResponse } from "next/server"
import { getWmsToken } from "@/lib/wms-auth"

// Warehouse names for filtering results (filter after fetching)
const WAREHOUSE_NAMES: Record<string, string[]> = {
  kent: ["Kent", "KENT", "kent"],
  moses: ["Moses Lake", "MOSES LAKE", "Moses", "moses"],
}

// Only include these warehouses (Kent and Moses Lake)
const ALLOWED_WAREHOUSES = ["Kent", "Moses Lake"]

// Suppliers to exclude
const EXCLUDED_SUPPLIERS = ["Julian Electric - newML"]

// WMS API returns PascalCase fields
interface ReceiverItem {
  ReadOnly?: {
    ReceiveItemId?: number
    UnitIdentifier?: {
      Name?: string
    }
  }
  ItemIdentifier?: {
    Sku?: string
    Description?: string
  }
  Qty?: number
  LotNumber?: string
  ReceivedDate?: string
}

interface Receiver {
  // PascalCase (actual WMS response)
  ReadOnly?: {
    ReceiverId?: number
    Status?: number
    ReceiverType?: number // 0 or 2 = normal, 1 = NCI
    CustomerIdentifier?: {
      Name?: string
      Id?: number
    }
    FacilityIdentifier?: {
      Name?: string
      Id?: number
    }
    CreationDate?: string
    LastModifiedDate?: string
  }
  ReceiverType?: number // Also check at top level
  ReferenceNum?: string
  PoNum?: string
  ArrivalDate?: string
  ReceiveDate?: string
  ReceiveItems?: ReceiverItem[]
}

interface WMSResponse {
  TotalResults?: number
  totalResults?: number
  ResourceList?: Receiver[]
  receivers?: Receiver[]
}

// This route fans out many upstream WMS requests, so give it room and never cache.
export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const warehouse = searchParams.get("warehouse") || "all"
  const receiverType = searchParams.get("receiverType") || "all" // "all", "1" (NCI), "2" (other)

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    )
  }

  try {
    const allReceivers: Receiver[] = []

    // Get OAuth token first
    const wmsToken = await getWmsToken()

    // Build RQL query: status==1 means received/completed
    const rql = `readOnly.status==1;arrivalDate=ge=${startDate};arrivalDate=lt=${endDate}`
    const encodedRql = encodeURIComponent(rql)

    // Optional receiverType filter (1=NCI). "normal"/"all" are filtered after fetch
    // because the WMS API can't express an OR across receiver types.
    const receiverTypeParam = receiverType === "1" ? "&receiverType=1" : ""

    // Large page size drastically reduces the number of round trips. The full
    // catalog can be tens of thousands of receivers (e.g. ~27k/year), so a small
    // page size + serial fetching would time out and silently truncate results,
    // dropping whole suppliers/warehouses (this is why HX/WHI - Kent went missing).
    const PAGE_SIZE = 500
    const CONCURRENCY = 5
    const MAX_PAGES = 300 // safety cap: up to 150k receivers

    const buildUrl = (pageNum: number) =>
      `https://secure-wms.com/inventory/receivers?detail=ReceiveItems&pgsiz=${PAGE_SIZE}&pgnum=${pageNum}&rql=${encodedRql}${receiverTypeParam}`

    // Fetch a single page with a couple of retries for transient errors, so a
    // one-off hiccup or rate limit doesn't truncate the whole result set.
    async function fetchPage(pageNum: number): Promise<{ receivers: Receiver[]; total: number }> {
      let lastError = ""
      for (let attempt = 1; attempt <= 3; attempt++) {
        const response = await fetch(buildUrl(pageNum), {
          method: "GET",
          headers: { Authorization: `Bearer ${wmsToken}`, Accept: "application/json" },
        })
        if (response.ok) {
          const data: WMSResponse = await response.json()
          return {
            receivers: data.ResourceList || data.receivers || [],
            total: data.TotalResults || data.totalResults || 0,
          }
        }
        lastError = `${response.status} - ${(await response.text()).substring(0, 200)}`
        console.error(`[v0] WMS page ${pageNum} attempt ${attempt} failed: ${lastError}`)
        // brief backoff before retrying
        await new Promise((r) => setTimeout(r, 400 * attempt))
      }
      throw new Error(`WMS API error on page ${pageNum}: ${lastError}`)
    }

    // Fetch page 1 to learn the total, then fetch the remaining pages in parallel batches.
    const firstPage = await fetchPage(1)
    allReceivers.push(...firstPage.receivers)

    const totalResults = firstPage.total
    const totalPages = Math.min(Math.ceil(totalResults / PAGE_SIZE), MAX_PAGES)
    console.log(`[v0] WMS TotalResults=${totalResults}, fetching ${totalPages} pages of ${PAGE_SIZE}`)

    const remainingPages: number[] = []
    for (let p = 2; p <= totalPages; p++) remainingPages.push(p)

    for (let i = 0; i < remainingPages.length; i += CONCURRENCY) {
      const batch = remainingPages.slice(i, i + CONCURRENCY)
      const results = await Promise.all(batch.map((p) => fetchPage(p)))
      for (const r of results) allReceivers.push(...r.receivers)
    }

    console.log(`[v0] Total receivers fetched: ${allReceivers.length} (expected ${totalResults})`)
    
    // Filter by receiverType if "normal" (0 or 2)
    let typeFilteredReceivers = allReceivers
    if (receiverType === "normal") {
      typeFilteredReceivers = allReceivers.filter(r => {
        const rType = r.ReceiverType ?? r.ReadOnly?.ReceiverType
        return rType === 0 || rType === 2
      })
      console.log(`[v0] After normal filter (type 0 or 2): ${typeFilteredReceivers.length} receivers`)
    }
    
    // First: filter to only Kent and Moses Lake warehouses, and exclude certain suppliers
    let filteredReceivers = typeFilteredReceivers.filter(r => {
      const facilityName = r.ReadOnly?.FacilityIdentifier?.Name || ""
      const supplierName = r.ReadOnly?.CustomerIdentifier?.Name || ""
      
      // Only include allowed warehouses (Kent or Moses Lake)
      const isAllowedWarehouse = ALLOWED_WAREHOUSES.some(allowed => 
        facilityName.toLowerCase().includes(allowed.toLowerCase())
      )
      
      // Exclude certain suppliers
      const isExcludedSupplier = EXCLUDED_SUPPLIERS.some(excluded =>
        supplierName.toLowerCase() === excluded.toLowerCase()
      )
      
      return isAllowedWarehouse && !isExcludedSupplier
    })
    
    console.log(`[v0] After base filter (Kent/Moses Lake, no excluded suppliers): ${filteredReceivers.length} receivers`)
    
    // Then: apply additional warehouse filter if specified
    if (warehouse !== "all" && WAREHOUSE_NAMES[warehouse]) {
      const warehouseNameMatches = WAREHOUSE_NAMES[warehouse]
      filteredReceivers = filteredReceivers.filter(r => {
        const facilityName = r.ReadOnly?.FacilityIdentifier?.Name || ""
        return warehouseNameMatches.some(name => 
          facilityName.toLowerCase().includes(name.toLowerCase())
        )
      })
    }
    
    console.log(`[v0] After warehouse filter (${warehouse}): ${filteredReceivers.length} receivers`)

    // Process and format the data (map PascalCase to camelCase)
    const formattedReceivers = filteredReceivers.map(receiver => {
      const items = receiver.ReceiveItems?.map(item => ({
        sku: item.ItemIdentifier?.Sku || "Unknown",
        qty: item.Qty || 0,
        description: item.ItemIdentifier?.Description || "",
        lotNumber: item.LotNumber || "",
        receivedDate: item.ReceivedDate || "",
      })) || []

      const totalQty = items.reduce((sum, item) => sum + item.qty, 0)
      const skuCount = new Set(items.map(i => i.sku)).size

      const facilityName = receiver.ReadOnly?.FacilityIdentifier?.Name || ""
      const supplierName = receiver.ReadOnly?.CustomerIdentifier?.Name || ""
      const receiverId = receiver.ReadOnly?.ReceiverId
      
      return {
        receiverId,
        referenceNum: receiver.ReferenceNum || receiver.PoNum || `RCV-${receiverId}`,
        poNum: receiver.PoNum || "",
        arrivalDate: receiver.ArrivalDate || "",
        receiveDate: receiver.ReceiveDate || "",
        warehouse: facilityName,
        supplier: supplierName,
        totalQty,
        skuCount,
        items,
      }
    })

    // Sort by arrival date descending
    formattedReceivers.sort((a, b) => 
      new Date(b.arrivalDate).getTime() - new Date(a.arrivalDate).getTime()
    )

    return NextResponse.json({
      success: true,
      totalReceivers: formattedReceivers.length,
      receivers: formattedReceivers,
      dateRange: { startDate, endDate },
      warehouse,
      receiverType,
    })

  } catch (error) {
    console.error("[v0] WMS API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch WMS data", details: String(error) },
      { status: 500 }
    )
  }
}
