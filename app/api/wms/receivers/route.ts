import { NextRequest, NextResponse } from "next/server"
import { getWmsToken } from "@/lib/wms-auth"

// Warehouse names for filtering results (filter after fetching)
const WAREHOUSE_NAMES: Record<string, string[]> = {
  kent: ["Kent", "KENT", "kent"],
  moses: ["Moses Lake", "MOSES LAKE", "Moses", "moses"],
}

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const warehouse = searchParams.get("warehouse") || "all"

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
    
    let pageNum = 1
    let hasMore = true

    while (hasMore) {
      // Build RQL query: status==1 means received/completed
      const rql = `readOnly.status==1;arrivalDate=ge=${startDate};arrivalDate=lt=${endDate}`
      const encodedRql = encodeURIComponent(rql)
      
      // Remove facilityId as it's not supported - we'll filter by warehouse name after
      const wmsUrl = `https://secure-wms.com/inventory/receivers?detail=ReceiveItems&pgsiz=100&pgnum=${pageNum}&rql=${encodedRql}`

      console.log(`[v0] Fetching WMS receivers, page ${pageNum}`)
      console.log(`[v0] WMS URL: ${wmsUrl}`)
      
      const response = await fetch(wmsUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${wmsToken}`,
          "Accept": "application/json",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[v0] WMS API error: ${response.status} ${response.statusText}`)
        console.error(`[v0] WMS API response: ${errorText}`)
        throw new Error(`WMS API error: ${response.status} - ${errorText.substring(0, 200)}`)
      }

      const data: WMSResponse = await response.json()
      
      // WMS API returns ResourceList (not receivers)
      const receivers = data.ResourceList || data.receivers || []
      const totalResults = data.TotalResults || data.totalResults || 0
      
      console.log(`[v0] WMS response totalResults: ${totalResults}`)
      console.log(`[v0] WMS response receivers count: ${receivers.length}`)
      
      // Log first receiver to debug structure
      if (receivers.length > 0) {
        console.log(`[v0] First receiver sample:`, JSON.stringify(receivers[0], null, 2).substring(0, 800))
      }
      
      if (receivers.length > 0) {
        allReceivers.push(...receivers)
        
        // Check if there are more pages
        if (receivers.length < 100) {
          hasMore = false
        } else {
          pageNum++
        }
      } else {
        hasMore = false
      }
    }
    
    console.log(`[v0] Total receivers fetched: ${allReceivers.length}`)
    
    // Filter by warehouse if specified (using PascalCase fields)
    let filteredReceivers = allReceivers
    if (warehouse !== "all" && WAREHOUSE_NAMES[warehouse]) {
      const warehouseNameMatches = WAREHOUSE_NAMES[warehouse]
      filteredReceivers = allReceivers.filter(r => {
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
    })

  } catch (error) {
    console.error("[v0] WMS API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch WMS data", details: String(error) },
      { status: 500 }
    )
  }
}
