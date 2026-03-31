import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getValidAccessToken } from "@/lib/microsoft-auth"
import * as XLSX from "xlsx"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Get all shared files from OneDrive (recursively)
async function getSharedFiles(accessToken: string) {
  const allFiles: Array<{
    id: string
    name: string
    driveId: string
    mimeType: string
  }> = []

  // First, get shared items
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me/drive/sharedWithMe",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] sharedWithMe error:", error)
    throw new Error(`Failed to get shared files: ${error}`)
  }

  const data = await response.json()
  console.log("[v0] sharedWithMe raw response:", JSON.stringify(data.value?.slice(0, 3)))

  // Process each shared item
  for (const item of data.value || []) {
    // For shared items, get the remote item info
    const remoteItem = item.remoteItem
    const actualItem = remoteItem || item
    const parentRef = actualItem.parentReference
    const driveId = parentRef?.driveId
    const itemId = actualItem.id

    // If it's a folder, scan inside it
    if (actualItem.folder && driveId && itemId) {
      console.log("[v0] Found shared folder:", item.name, "- scanning contents...")
      const folderFiles = await scanFolder(accessToken, driveId, itemId)
      allFiles.push(...folderFiles)
    } 
    // If it's a file, check if it's PDF or Excel
    else if (actualItem.file) {
      const name = item.name?.toLowerCase() || ""
      if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".pdf")) {
        const fileInfo = actualItem.file
        allFiles.push({
          id: remoteItem ? remoteItem.id : item.id,
          name: item.name,
          driveId: driveId,
          mimeType: fileInfo?.mimeType || "",
        })
        console.log("[v0] Found shared file:", item.name)
      }
    }
  }

  return allFiles
}

// Recursively scan folder for Excel/PDF files
async function scanFolder(
  accessToken: string, 
  driveId: string, 
  folderId: string
): Promise<Array<{ id: string; name: string; driveId: string; mimeType: string }>> {
  const files: Array<{ id: string; name: string; driveId: string; mimeType: string }> = []

  const endpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children`
  
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    console.error("[v0] Failed to scan folder:", folderId)
    return files
  }

  const data = await response.json()

  for (const item of data.value || []) {
    if (item.folder) {
      // Recursively scan subfolders
      const subFiles = await scanFolder(accessToken, driveId, item.id)
      files.push(...subFiles)
    } else if (item.file) {
      const name = item.name?.toLowerCase() || ""
      if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".pdf")) {
        files.push({
          id: item.id,
          name: item.name,
          driveId: driveId,
          mimeType: item.file?.mimeType || "",
        })
        console.log("[v0] Found file in folder:", item.name)
      }
    }
  }

  return files
}

// Download file content
async function downloadFile(accessToken: string, driveId: string, fileId: string) {
  const endpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}`

  const metaResponse = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!metaResponse.ok) {
    throw new Error(`Failed to get file metadata`)
  }

  const metadata = await metaResponse.json()
  const downloadUrl = metadata["@microsoft.graph.downloadUrl"]

  if (!downloadUrl) {
    throw new Error("No download URL available")
  }

  const contentResponse = await fetch(downloadUrl)
  if (!contentResponse.ok) {
    throw new Error("Failed to download file")
  }

  return await contentResponse.arrayBuffer()
}

// Parse Excel to text
function parseExcelToText(buffer: ArrayBuffer, filename: string): string {
  const workbook = XLSX.read(buffer, { type: "array" })
  const result: string[] = []

  result.push(`=== File: ${filename} ===`)

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][]

    result.push(`\n=== Sheet: ${sheetName} ===`)

    const maxRows = Math.min(data.length, 200)
    for (let i = 0; i < maxRows; i++) {
      const row = data[i]
      if (Array.isArray(row) && row.some(cell => cell !== "")) {
        result.push(`Row ${i + 1}: ${row.map(cell => String(cell)).join(" | ")}`)
      }
    }
  }

  return result.join("\n")
}

export async function POST() {
  console.log("[v0] Sync API called")
  
  try {
    // Check authentication
    const accessToken = await getValidAccessToken()
    console.log("[v0] Access token:", accessToken ? "exists" : "missing")
    
    if (!accessToken) {
      return NextResponse.json(
        { error: "not_authenticated", message: "Please sign in with Microsoft" },
        { status: 401 }
      )
    }

    // Get all shared files
    console.log("[v0] Fetching shared files...")
    const files = await getSharedFiles(accessToken)
    console.log("[v0] Found files:", files.length, files.map(f => f.name))

    if (files.length === 0) {
      console.log("[v0] No files found, returning empty result")
      return NextResponse.json({
        newRows: [],
        filesProcessed: [],
        summary: {
          totalFiles: 0,
          totalNewRows: 0,
          suppliers: [],
        },
      })
    }

    // Download and parse all files
    console.log("[v0] Downloading and parsing files...")
    const fileContents: Array<{ name: string; content: string }> = []

    for (const file of files) {
      try {
        console.log("[v0] Processing file:", file.name)
        const buffer = await downloadFile(accessToken, file.driveId, file.id)

        if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) {
          const text = parseExcelToText(buffer, file.name)
          fileContents.push({ name: file.name, content: text })
        } else if (file.name.toLowerCase().endsWith(".pdf")) {
          // For PDF, we'll send to Claude directly with base64
          const base64 = Buffer.from(buffer).toString("base64")
          fileContents.push({ name: file.name, content: `[PDF:${base64}]` })
        }
      } catch (err) {
        console.error(`[v0] Failed to process file ${file.name}:`, err)
      }
    }

    // Prepare content for Claude
    console.log("[v0] Preparing content for Claude, files processed:", fileContents.length)
    const filesText = fileContents
      .filter(f => !f.content.startsWith("[PDF:"))
      .map(f => f.content)
      .join("\n\n---\n\n")

    console.log("[v0] Calling Claude API...")
    // Call Claude with scm-file-processor and scm-master-generator skills
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16384,
      system: `You are an SCM (Supply Chain Management) data processor. 

You have two skills:
1. scm-file-processor: Process PO/Invoice files and extract structured data
2. scm-master-generator: Generate a master table with 15 columns

The 15 columns for the master table are:
1. WHI PO - WHI internal PO number
2. Supplier Invoice - Invoice number from supplier
3. Supplier - Supplier name (HX, AMC, TJJSH, etc.)
4. Customer - Customer name
5. Container No. - Container number
6. Container Type - 20GP, 40GP, or 40HQ only
7. BL No. - Bill of Lading number
8. Vessel - Vessel name
9. SKU - Product SKU with full suffix
10. Description - Product description
11. Qty - Quantity in pieces
12. Unit Price - Price per piece in USD
13. Amount - Total amount (Qty * Unit Price)
14. ETD - Estimated Time of Departure (YYYY-MM-DD)
15. ETA - Estimated Time of Arrival (YYYY-MM-DD, or ETD + 30 days)

Rules:
- Each unique (Invoice, Container, SKU) combination = one row
- Standardize container types to: 20GP, 40GP, or 40HQ only
- Only include rows where Qty > 0
- Format all dates as YYYY-MM-DD
- Preserve full SKU suffixes (like GT)
- Use $/PCS for unit price, NOT $/MT

Return the result as JSON with this structure:
{
  "rows": [
    {
      "whiPo": string,
      "supplierInvoice": string,
      "supplier": string,
      "customer": string,
      "containerNo": string,
      "containerType": string,
      "blNo": string,
      "vessel": string,
      "sku": string,
      "description": string,
      "qty": number,
      "unitPrice": number,
      "amount": number,
      "etd": string,
      "eta": string
    }
  ],
  "filesProcessed": string[],
  "suppliers": string[]
}`,
      messages: [
        {
          role: "user",
          content: `Process all these files and generate the master table data:

${filesText}

Extract all line items and return the complete master table as JSON.`,
        },
      ],
    })

    // Extract text response
    console.log("[v0] Claude response received")
    const textContent = response.content.find(c => c.type === "text")
    if (!textContent || textContent.type !== "text") {
      throw new Error("No response from Claude")
    }
    console.log("[v0] Claude response length:", textContent.text.length)

    // Parse JSON from response
    let result: {
      rows: Array<{
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
      }>
      filesProcessed: string[]
      suppliers: string[]
    }

    try {
      const jsonMatch = textContent.text.match(/```json\n?([\s\S]*?)\n?```/) ||
                       textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0]
        result = JSON.parse(jsonStr)
      } else {
        throw new Error("No JSON found in response")
      }
    } catch (parseError) {
      console.error("[v0] JSON parse error:", parseError)
      console.error("[v0] Raw response:", textContent.text.substring(0, 500))
      throw new Error("Failed to parse Claude response")
    }

    const finalResult = {
      newRows: result.rows || [],
      filesProcessed: result.filesProcessed || fileContents.map(f => f.name),
      summary: {
        totalFiles: fileContents.length,
        totalNewRows: result.rows?.length || 0,
        suppliers: result.suppliers || [],
      },
    }
    
    console.log("[v0] Sync complete - files:", finalResult.summary.totalFiles, "rows:", finalResult.summary.totalNewRows)
    return NextResponse.json(finalResult)
  } catch (err) {
    console.error("[v0] Sync error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    )
  }
}
