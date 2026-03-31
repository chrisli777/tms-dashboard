import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getValidAccessToken } from "@/lib/microsoft-auth"
import * as XLSX from "xlsx"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface OneDriveFile {
  id: string
  name: string
  driveId?: string
  mimeType?: string
}

interface OneDriveFolder {
  id: string
  name: string
  driveId?: string
}

// Get all shared files from OneDrive using the same logic as /api/onedrive/files
async function getSharedFiles(accessToken: string): Promise<OneDriveFile[]> {
  const allFiles: OneDriveFile[] = []

  // First get root shared items
  const rootResult = await listSharedWithMe(accessToken)
  
  // Add files directly shared
  allFiles.push(...rootResult.files)
  
  // For each shared folder, recursively get contents
  for (const folder of rootResult.folders) {
    if (folder.driveId && folder.id) {
      const folderFiles = await getAllFilesInFolder(accessToken, folder.driveId, folder.id)
      allFiles.push(...folderFiles)
    }
  }

  return allFiles
}

// List files shared with the current user (same logic as /api/onedrive/files)
async function listSharedWithMe(accessToken: string): Promise<{ files: OneDriveFile[]; folders: OneDriveFolder[] }> {
  const endpoint = "https://graph.microsoft.com/v1.0/me/drive/sharedWithMe"

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to list shared files: ${error}`)
  }

  const data = await response.json()
  return parseItems(data.value || [])
}

// Recursively get all files in a folder
async function getAllFilesInFolder(accessToken: string, driveId: string, folderId: string): Promise<OneDriveFile[]> {
  const allFiles: OneDriveFile[] = []
  const endpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children`

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    return allFiles
  }

  const data = await response.json()
  const { files, folders } = parseItems(data.value || [], driveId)

  allFiles.push(...files)

  // Recursively get files from subfolders
  for (const folder of folders) {
    if (folder.driveId && folder.id) {
      const subFiles = await getAllFilesInFolder(accessToken, folder.driveId, folder.id)
      allFiles.push(...subFiles)
    }
  }

  return allFiles
}

// Parse Graph API response items into files and folders (same logic as /api/onedrive/files)
function parseItems(
  items: Array<Record<string, unknown>>,
  parentDriveId?: string
): { files: OneDriveFile[]; folders: OneDriveFolder[] } {
  const files: OneDriveFile[] = []
  const folders: OneDriveFolder[] = []

  for (const item of items) {
    // For shared items, get the remote item info
    const remoteItem = item.remoteItem as Record<string, unknown> | undefined
    const actualItem = remoteItem || item
    const parentRef = actualItem.parentReference as Record<string, unknown> | undefined
    const driveId = parentRef?.driveId as string || parentDriveId

    if (actualItem.folder) {
      folders.push({
        id: remoteItem ? (remoteItem.id as string) : (item.id as string),
        name: item.name as string,
        driveId: driveId,
      })
    } else if (actualItem.file) {
      const name = item.name as string
      // Filter to only PDF and Excel files
      const isPdfOrExcel =
        name.toLowerCase().endsWith(".pdf") ||
        name.toLowerCase().endsWith(".xlsx") ||
        name.toLowerCase().endsWith(".xls")

      if (isPdfOrExcel) {
        const fileInfo = actualItem.file as Record<string, unknown>
        files.push({
          id: remoteItem ? (remoteItem.id as string) : (item.id as string),
          name: name,
          driveId: driveId,
          mimeType: fileInfo?.mimeType as string,
        })
      }
    }
  }

  return { files, folders }
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
        debug: "No files found in sharedWithMe. Make sure files are shared with you.",
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
      debug: `Found ${files.length} files: ${files.map(f => f.name).join(", ")}`,
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
