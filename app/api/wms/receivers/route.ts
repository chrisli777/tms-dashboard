import { NextRequest, NextResponse } from "next/server"
import { getWmsToken } from "@/lib/wms-auth"

// Warehouse names for filtering results (filter after fetching)
const WAREHOUSE_NAMES: Record<string, string[]> = {
  kent: ["Kent", "KENT", "kent"],
  moses: ["Moses Lake", "MOSES LAKE", "Moses", "moses"],
}

interface ReceiverItem {
  itemIdentifier?: {
    sku?: string
  }
  qty?: number
  lotNumber?: string
  receivedDate?: string
}

interface Receiver {
  receiverId?: number
  referenceNum?: string
  poNum?: string
  arrivalDate?: string
  receiveDate?: string
  status?: number
  facilityId?: number
  receiveItems?: ReceiverItem[]
  readOnly?: {
    status?: number
    facilityIdentifier?: {
      name?: string
    }
  }
}

interface WMSResponse {
  totalResults?: number
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
      
      console.log(`[v0] WMS response totalResults: ${data.totalResults}`)
      console.log(`[v0] WMS response receivers count: ${data.receivers?.length || 0}`)
      
      // Log raw response structure to debug
      if (data.receivers && data.receivers.length > 0) {
        console.log(`[v0] First receiver sample:`, JSON.stringify(data.receivers[0], null, 2).substring(0, 500))
      } else {
        console.log(`[v0] No receivers in response. Raw data keys:`, Object.keys(data))
      }
      
      if (data.receivers && data.receivers.length > 0) {
        allReceivers.push(...data.receivers)
        
        // Check if there are more pages
        if (data.receivers.length < 100) {
          hasMore = false
        } else {
          pageNum++
        }
      } else {
        hasMore = false
      }
    }
    
    console.log(`[v0] Total receivers fetched: ${allReceivers.length}`)
    
    // Filter by warehouse if specified
    let filteredReceivers = allReceivers
    if (warehouse !== "all" && WAREHOUSE_NAMES[warehouse]) {
      const warehouseNameMatches = WAREHOUSE_NAMES[warehouse]
      filteredReceivers = allReceivers.filter(r => {
        const facilityName = r.readOnly?.facilityIdentifier?.name || ""
        return warehouseNameMatches.some(name => 
          facilityName.toLowerCase().includes(name.toLowerCase())
        )
      })
    }
    
    console.log(`[v0] After warehouse filter (${warehouse}): ${filteredReceivers.length} receivers`)

    // Process and format the data
    const formattedReceivers = filteredReceivers.map(receiver => {
      const items = receiver.receiveItems?.map(item => ({
        sku: item.itemIdentifier?.sku || "Unknown",
        qty: item.qty || 0,
        lotNumber: item.lotNumber || "",
        receivedDate: item.receivedDate || "",
      })) || []

      const totalQty = items.reduce((sum, item) => sum + item.qty, 0)
      const skuCount = new Set(items.map(i => i.sku)).size

      const facilityName = receiver.readOnly?.facilityIdentifier?.name || ""
      
      return {
        receiverId: receiver.receiverId,
        referenceNum: receiver.referenceNum || receiver.poNum || `RCV-${receiver.receiverId}`,
        poNum: receiver.poNum || "",
        arrivalDate: receiver.arrivalDate || "",
        receiveDate: receiver.receiveDate || "",
        warehouse: facilityName,
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
