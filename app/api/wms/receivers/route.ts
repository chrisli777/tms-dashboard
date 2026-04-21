import { NextRequest, NextResponse } from "next/server"

// WMS API credentials - use env var if available, fallback to provided base64
const WMS_AUTH = process.env.WMS_API_KEY || "NmZkYjQ2MjUtMDE3YS00YmZjLWI4OWUtOTA4YzQ4NDI3ZTA4OjUxT3NmNHVvTVpNSkpoaHA2dHF6WU40MDFtTFhoR3I0"

// Warehouse facility IDs - update these to match your actual facility IDs
const WAREHOUSES: Record<string, number> = {
  kent: 4,    // Kent warehouse facility ID
  moses: 5,   // Moses Lake warehouse facility ID
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
    
    // Determine which warehouses to query
    const warehousesToQuery = warehouse === "all" 
      ? Object.entries(WAREHOUSES) 
      : [[warehouse, WAREHOUSES[warehouse as keyof typeof WAREHOUSES]]]

    for (const [warehouseName, facilityId] of warehousesToQuery) {
      if (!facilityId) continue

      let pageNum = 1
      let hasMore = true

      while (hasMore) {
        // Build RQL query: status==1 means received/completed
        const rql = `readOnly.status==1;arrivalDate=ge=${startDate};arrivalDate=lt=${endDate}`
        const encodedRql = encodeURIComponent(rql)
        
        const wmsUrl = `https://secure-wms.com/inventory/receivers?detail=ReceiveItems&facilityId=${facilityId}&pgsiz=100&pgnum=${pageNum}&rql=${encodedRql}`

        console.log(`[v0] Fetching WMS receivers: ${warehouseName}, page ${pageNum}`)

        console.log(`[v0] WMS URL: ${wmsUrl}`)
        console.log(`[v0] Using auth (first 20 chars): ${WMS_AUTH.substring(0, 20)}...`)
        
        const response = await fetch(wmsUrl, {
          method: "GET",
          headers: {
            "Authorization": `Basic ${WMS_AUTH}`,
            "Accept": "application/hal+json",
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[v0] WMS API error: ${response.status} ${response.statusText}`)
          console.error(`[v0] WMS API response: ${errorText}`)
          throw new Error(`WMS API error: ${response.status} - ${errorText.substring(0, 200)}`)
        }

        const data: WMSResponse = await response.json()
        
        if (data.receivers && data.receivers.length > 0) {
          // Add warehouse name to each receiver
          const receiversWithWarehouse = data.receivers.map(r => ({
            ...r,
            warehouseName,
          }))
          allReceivers.push(...receiversWithWarehouse)
          
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
    }

    // Process and format the data
    const formattedReceivers = allReceivers.map(receiver => {
      const items = receiver.receiveItems?.map(item => ({
        sku: item.itemIdentifier?.sku || "Unknown",
        qty: item.qty || 0,
        lotNumber: item.lotNumber || "",
        receivedDate: item.receivedDate || "",
      })) || []

      const totalQty = items.reduce((sum, item) => sum + item.qty, 0)
      const skuCount = new Set(items.map(i => i.sku)).size

      return {
        receiverId: receiver.receiverId,
        referenceNum: receiver.referenceNum || receiver.poNum || `RCV-${receiver.receiverId}`,
        poNum: receiver.poNum || "",
        arrivalDate: receiver.arrivalDate || "",
        receiveDate: receiver.receiveDate || "",
        warehouse: (receiver as Receiver & { warehouseName?: string }).warehouseName || "Unknown",
        facilityName: receiver.readOnly?.facilityIdentifier?.name || "",
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
