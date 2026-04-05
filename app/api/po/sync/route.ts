import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getValidAccessToken } from "@/lib/microsoft-auth"
import * as XLSX from "xlsx"
import pdf from "pdf-parse"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// SCM File Processor Skill - complete version with BOL extraction
const SCM_FILE_PROCESSOR_SKILL = `# SCM File Processor

Parse supplier shipment files into unified 15-column Order Management table.

## Supplier Detection (from filename OR folder path)

Check BOTH the filename AND the folder path provided:
- Path or filename contains "AMC" → supplier="AMC", customer="Genie"
- Path or filename contains "Terex" → supplier="HX", customer="Genie"  
- Path or filename contains "CLARK" → supplier="HX", customer="Clark"
- Path or filename contains "TJLT" → supplier="TJJSH", customer="Genie"

Example: File "Invoice-20251115.xlsx" in folder "AMC/Invoice-20251115-25111501" → supplier="AMC"

## Output: 15-Column Table

| Column | Type | Notes |
|--------|------|-------|
| Supplier | string | AMC / HX / TJJSH |
| Customer | string | Genie / Clark / Deere |
| Invoice | string | Full prefix preserved |
| BL No. | string | MBL preferred, extract from folder name if contains BL number |
| WHI PO | string | Original format |
| Container | string | 4 letters + 7 digits (e.g. MSOU7576033) |
| Type | string | 20GP / 40GP / 40HQ ONLY |
| SKU | string | Keep GT suffix for HX, strip -A/-B/-C for AMC |
| Qty | int | > 0 only |
| GW(kg) | float | MT × 1000 |
| Unit Price(USD) | float | $/PCS (never $/MT) |
| Amount(USD) | float | Qty × Price |
| ETD | date | YYYY-MM-DD |
| ETA | date | ETD + 30 days if unavailable |
| Status | string | Cleared / In Transit / Pending |

## 1. AMC (Excel files in AMC folder)

**Folder path**: AMC/Invoice-{date}-{invoiceNo}/ or AMC/{invoiceNo}/
**supplier="AMC", customer="Genie"**

**Invoice# extraction**:
- From folder name: "Invoice-20251115-25111501" → Invoice = "25111501"
- From folder name: "AMC2026-0301 3.11 8小6大 DOC" → Invoice = "AMC2026-0301"

**BOL PDF contains ALL key data**:
- B/L No.: "FSHA01261586" (from B/L No. field)
- WHI PO: From "Marks and Numbers" field, e.g. "0000718,8803AMC-0000720" → WHI PO = "0000718" or "0000720"
- Container table with: CONTAINER# /SEAL#/TYPE, PKG, KGS, CBM
  - "VPLU3220052 /EMCQDC5764/20'" → Container: VPLU3220052, Type: 20GP
  - "GCXU6428302 /EMCWKS7294/40H" → Container: GCXU6428302, Type: 40HQ
- Date of Issue → ETD

**AMC has TWO types of Excel files**:

1. **Full Invoice Excel** (like "AMC2026-0301 3.11 8小6大 DOC. (1)(3).xlsx"):
   - Has header row with: Part/PN | PO | Qty | Unit Price | Amount
   - Contains WHI PO and pricing info
   - Parse: Part# → SKU, PO → WHI PO, Unit Price, Amount

2. **Receipts Excel** (like "receipts.xlsx" or "receipts-11-15.xlsx"):
   - Only has: Container | Type | PN | Qty | GW
   - NO WHI PO, NO pricing
   - Used for Container/Type mapping to SKUs
   - If only receipts file exists, WHI PO = "" and unitPrice = 0

**IMPORTANT**: When parsing receipts-only folders:
- Still extract Container, Type, SKU, Qty from receipts
- WHI PO stays empty (will be filled from PO master later)
- unitPrice = 0, amount = 0 (pricing unavailable)
- These are "pending" items that need PO matching

**Container extraction from receipts**:
- Container format: 4 letters + 7 digits (e.g. EMCU8816472)
- Type: 20GP / 40GP / 40HQ
- Each row maps Container + Type + SKU + Qty

**SKU cleanup**: 1260198-A → 1260198, 132383-C → 132383 (strip letter suffix)

## 2. HX-Genie (.xlsx, 6-sheet workbook)

**Filename**: Terex{YYYY}-{batch}...
**supplier="HX", customer="Genie"**

**Invoice Sheet**:
- Header Row ~24: PART NO. | PART NAME | P.O NO. | Q'TY | WEIGHT | $/MT | $/PCS | AMOUNT
- Metadata: H9=Invoice Date, H10=Invoice#, H15=ETD
- Column mapping: ColA → SKU (keep GT suffix), ColD → WHI PO, ColE → Qty, ColH → $/PCS (NOT $/MT!), ColI → Amount

**Details of Containers Sheet** (sheet name may have trailing space):
- R1,C3 = Vessel, R2,C3 = BL# (MBL), R5,C3 = ETD
- R7 = Header, R8+ = Container data (odd rows=data, even rows=total)
- Col2 = Container NO., Col3 = Seal NO., Col6 = Quantity
- Container type: "20" → 20GP, "40"+"H"/"HQ" → 40HQ, "40" alone → 40GP

## 3. HX-Clark (.xls/.xlsx, 6-sheet)

**Filename**: CLARK{YYYYMMDD}...
**supplier="HX", customer="Clark"**

**Invoice Sheet**:
- Header Row 15: PART NO. | ORDER NO. | Q'TY | $/PCS | AMOUNT
- Metadata: R7,C7 = ETD, R8,C7 = Invoice#
- Column mapping: C1 → SKU (7-digit, no GT suffix), C2 → WHI PO, C4 → Qty, C7 → $/PCS, C8 → Amount

**Details of Containers Sheet**:
- R1,C2 = Invoice#, R2,C2 = BL#, R3,C2 = Vessel
- R7+ = Container data (one container spans multiple SKU rows)
- Skip rows where GW=0 AND NW=0 (Zone 2 filter)

## 4. TJJSH (.xlsx, 5-sheet)

**Filename**: TJLT{YYYYMMDD}...
**supplier="TJJSH", customer="Genie"**

**CI Sheet** (Commercial Invoice):
- Metadata: R3,C7 = Invoice#, R4,C7 = Date, R5,C7 = PO
- Header Row 17: C4=Part Number, C5=QTY, C6=$/PCS, C7=AMOUNT, C9=WHI PO
- SKU format: 8803-{number} (no GT suffix)

## Container Type Standardization

| Raw | Standard |
|-----|----------|
| 20G, 20'GP, 20GP, 20BX, 20ST | **20GP** |
| 40G, 40GP | **40GP** |
| 40HQ, 40HC, 40'HQ | **40HQ** |

## Output JSON

{
  "rows": [
    {
      "supplier": "AMC",
      "customer": "Genie",
      "supplierInvoice": "25111501",
      "blNo": "142503419969",
      "whiPo": "0000728",
      "containerNo": "MSOU7576033",
      "containerType": "40HQ",
      "sku": "1260198",
      "qty": 120,
      "gw": 1500,
      "unitPrice": 5.50,
      "amount": 660.00,
      "etd": "2026-03-01",
      "eta": "2026-03-31",
      "status": "In Transit"
    }
  ],
  "supplier": "AMC"
}

If file is not a valid PO/Invoice:
{"skip": true, "reason": "description"}
`

interface OneDriveFile {
  id: string
  name: string
  driveId?: string
  mimeType?: string
  folderPath?: string // Track parent folder path for supplier detection
}

interface OneDriveFolder {
  id: string
  name: string
  driveId?: string
  folderPath?: string // Track path for nested folder detection
}

// Check if a folder name is a supplier folder we should scan
function isSupplierFolder(folderName: string): boolean {
  const name = folderName.toLowerCase()
  // Only scan exact supplier folders, not folders that just contain supplier names
  // e.g. "AMC" yes, "AMC PIPELINE WEEK 5" no
  return name === "amc" || 
         name.startsWith("terex") || 
         name.startsWith("clark") || 
         name.startsWith("tjlt")
}

// Get ALL files from OneDrive (both my files and shared with me)
async function getAllOneDriveFiles(accessToken: string): Promise<OneDriveFile[]> {
  const allFiles: OneDriveFile[] = []

  // 1. Get files shared with me
  try {
    const sharedResult = await listSharedWithMe(accessToken)
    allFiles.push(...sharedResult.files)
    
    // Only scan supplier folders - filter before recursing
    const supplierFolders = sharedResult.folders.filter(f => isSupplierFolder(f.name))
    console.log("[v0] Shared supplier folders:", supplierFolders.map(f => f.name))
    
    for (const folder of supplierFolders) {
      if (folder.driveId && folder.id) {
        const folderFiles = await getAllFilesInFolder(accessToken, folder.driveId, folder.id, folder.name)
        allFiles.push(...folderFiles)
      }
    }
  } catch (err) {
    console.error("[v0] Error fetching shared files:", err)
  }

  // 2. Get my own files from root drive
  try {
    const myFilesResult = await listMyFiles(accessToken)
    allFiles.push(...myFilesResult.files)
    
    // Only scan supplier folders - filter before recursing
    const supplierFolders = myFilesResult.folders.filter(f => isSupplierFolder(f.name))
    console.log("[v0] My supplier folders:", supplierFolders.map(f => f.name))
    
    for (const folder of supplierFolders) {
      if (folder.driveId && folder.id) {
        const folderFiles = await getAllFilesInFolder(accessToken, folder.driveId, folder.id, folder.name)
        allFiles.push(...folderFiles)
      }
    }
  } catch (err) {
    console.error("[v0] Error fetching my files:", err)
  }

  return allFiles
}

// List my own files
async function listMyFiles(accessToken: string): Promise<{ files: OneDriveFile[]; folders: OneDriveFolder[] }> {
  const endpoint = "https://graph.microsoft.com/v1.0/me/drive/root/children"

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to list my files: ${error}`)
  }

  const data = await response.json()
  
  // Get drive ID from the first item's parent reference
  let driveId: string | undefined
  if (data.value?.length > 0) {
    driveId = data.value[0].parentReference?.driveId
  }
  
  return parseItems(data.value || [], driveId)
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

// Recursively get all files in a folder with pagination and path tracking
async function getAllFilesInFolder(accessToken: string, driveId: string, folderId: string, folderPath = "", depth = 0): Promise<OneDriveFile[]> {
  const allFiles: OneDriveFile[] = []
  
  // Limit recursion depth to prevent infinite loops
  if (depth > 10) {
    console.log("[v0] Max folder depth reached")
    return allFiles
  }
  
  let nextLink: string | null = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children?$top=200`

  while (nextLink) {
    const response = await fetch(nextLink, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      console.log("[v0] Failed to list folder:", folderId, "status:", response.status)
      break
    }

    const data = await response.json()
    const { files, folders } = parseItems(data.value || [], driveId, folderPath)

    allFiles.push(...files)
    console.log("[v0] Found", files.length, "files in folder:", folderPath, "depth", depth)

    // Recursively get files from subfolders with updated path
    for (const folder of folders) {
      if (folder.driveId && folder.id) {
        const newPath = folderPath ? `${folderPath}/${folder.name}` : folder.name
        const subFiles = await getAllFilesInFolder(accessToken, folder.driveId, folder.id, newPath, depth + 1)
        allFiles.push(...subFiles)
      }
    }

    // Handle pagination
    nextLink = data["@odata.nextLink"] || null
  }

  return allFiles
}

// Parse Graph API response items into files and folders with folder path tracking
function parseItems(
  items: Array<Record<string, unknown>>,
  parentDriveId?: string,
  folderPath?: string
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
        folderPath: folderPath,
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
          folderPath: folderPath, // Track the folder path for supplier detection
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

// Pre-filter files by name OR folder path - per skill definition
// Only match specific supplier folders, not general folders containing supplier names
function isPotentialPOFile(filename: string, folderPath?: string): boolean {
  const name = filename.toLowerCase()
  const path = (folderPath || "").toLowerCase()
  
  // Get the top-level folder name (first segment of path)
  const topFolder = path.split("/")[0] || ""
  
  // HX → Genie: top folder is "terex" or filename contains "terex"
  if (topFolder.startsWith("terex") || name.includes("terex")) return true
  
  // HX → Clark: top folder is "clark" or filename contains "clark"
  if (topFolder.startsWith("clark") || name.includes("clark")) return true
  
  // TJJSH: top folder starts with "tjlt" or filename contains "tjlt"
  if (topFolder.startsWith("tjlt") || name.includes("tjlt")) return true
  
  // AMC: top folder is exactly "amc" (not "amc pipeline", "amc something else")
  // This ensures we only scan the "AMC" folder, not "AMC PIPELINE WEEK 5" etc.
  if (topFolder === "amc" || name.startsWith("amc")) return true
  
  // All other files are skipped
  return false
}

// Parse PDF to text - extract text content for BL# and container info
async function parsePdfToText(buffer: ArrayBuffer, filename: string): Promise<string> {
  try {
    const data = await pdf(Buffer.from(buffer))
    const result: string[] = []
    result.push(`=== PDF File: ${filename} ===`)
    result.push(data.text)
    return result.join("\n")
  } catch (err) {
    console.error("[v0] Failed to parse PDF:", filename, err)
    return `=== PDF File: ${filename} ===\n[Failed to parse PDF content]`
  }
}

// Parse Excel to text - include ALL sheets with more rows for container data
function parseExcelToText(buffer: ArrayBuffer, filename: string): string {
  const workbook = XLSX.read(buffer, { type: "array" })
  const result: string[] = []

  result.push(`=== File: ${filename} ===`)
  result.push(`Sheets: ${workbook.SheetNames.join(", ")}`)

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][]

    result.push(`\n=== Sheet: ${sheetName} ===`)

    // Include more rows (up to 300) to ensure container data is captured
    const maxRows = Math.min(data.length, 300)
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
  // Use streaming to send real-time progress updates
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send("progress", { step: "auth", message: "Checking authentication...", percent: 5 })
        
        // Check authentication
        const accessToken = await getValidAccessToken()
        
        if (!accessToken) {
          send("error", { error: "not_authenticated", message: "Please sign in with Microsoft" })
          controller.close()
          return
        }

        send("progress", { step: "scan", message: "Scanning OneDrive...", percent: 10 })
        
        // Get ALL files (my files + shared with me)
        const files = await getAllOneDriveFiles(accessToken)

        if (files.length === 0) {
          send("complete", {
            newRows: [],
            filesProcessed: [],
            summary: { totalFiles: 0, totalNewRows: 0, suppliers: [] },
            debug: "No PDF/Excel files found in OneDrive.",
          })
          controller.close()
          return
        }

        send("progress", { 
          step: "download", 
          message: `Found ${files.length} files. Downloading...`, 
          percent: 20,
          filesFound: files.map(f => f.name)
        })

        // Pre-filter files by name OR folder path pattern, then download
        const potentialPOFiles = files.filter(f => isPotentialPOFile(f.name, f.folderPath))
        const skippedCount = files.length - potentialPOFiles.length
        
        console.log("[v0] Total files found:", files.length)
        console.log("[v0] Potential PO files:", potentialPOFiles.length)
        console.log("[v0] PO files:", potentialPOFiles.map(f => `${f.folderPath}/${f.name}`))
        
        send("progress", { 
          step: "download", 
          message: `Found ${potentialPOFiles.length} potential PO files (skipped ${skippedCount} unrelated)`, 
          percent: 25
        })

        const fileContents: Array<{ name: string; content: string; folderPath?: string; isPdf?: boolean }> = []
        let downloadedCount = 0

        for (const file of potentialPOFiles) {
          try {
            send("progress", { 
              step: "download", 
              message: `Downloading: ${file.name}`, 
              percent: 25 + Math.round((downloadedCount / potentialPOFiles.length) * 25)
            })
            
            const buffer = await downloadFile(accessToken, file.driveId!, file.id)

            if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) {
              const text = parseExcelToText(buffer, file.name)
              fileContents.push({ name: file.name, content: text, folderPath: file.folderPath })
            } else if (file.name.toLowerCase().endsWith(".pdf")) {
              // Parse PDF to extract text (for BL#, container info)
              const text = await parsePdfToText(buffer, file.name)
              fileContents.push({ name: file.name, content: text, folderPath: file.folderPath, isPdf: true })
            }
            
            downloadedCount++
          } catch (err) {
            console.error(`[v0] Failed to download ${file.name}:`, err)
            downloadedCount++
          }
        }
        
        if (fileContents.length === 0) {
          send("complete", {
            newRows: [],
            filesProcessed: [],
            summary: { totalFiles: 0, totalNewRows: 0, suppliers: [] },
            debug: "No files downloaded from OneDrive.",
          })
          controller.close()
          return
        }

        send("progress", { step: "process", message: "Grouping files by folder...", percent: 55 })

        // Group files by folder (Invoice folder = one shipment)
        const filesByFolder: Record<string, Array<{ name: string; content: string; isPdf?: boolean }>> = {}
        
        for (const file of fileContents) {
          // Get the invoice folder path (e.g. "AMC/Invoice-20251115-25111501")
          const folderKey = file.folderPath || "root"
          if (!filesByFolder[folderKey]) {
            filesByFolder[folderKey] = []
          }
          filesByFolder[folderKey].push(file)
        }
        
        const folderKeys = Object.keys(filesByFolder)
        console.log("[v0] Grouped into", folderKeys.length, "folders:", folderKeys)
        
        const allRows: Array<Record<string, unknown>> = []
        const processedFiles: string[] = []
        const suppliers = new Set<string>()
        let processedCount = 0

        // Process each folder as a unit (all files in folder sent together)
        for (const folderKey of folderKeys) {
          const folderFiles = filesByFolder[folderKey]
          const pdfFiles = folderFiles.filter(f => f.isPdf)
          const excelFiles = folderFiles.filter(f => !f.isPdf)
          
          if (excelFiles.length === 0) {
            console.log("[v0] Skipping folder with no Excel files:", folderKey)
            processedCount++
            continue
          }
          
          send("progress", { 
            step: "process", 
            message: `Processing folder: ${folderKey} (${folderFiles.length} files)`, 
            percent: 55 + Math.round((processedCount / Math.max(folderKeys.length, 1)) * 40)
          })
          
          // Extract FULL BOL info from PDFs in this folder
          let blNo = ""
          let whiPoFromBol = ""
          let etd = ""
          const containerList: Array<{ container: string; type: string; qty: number; kgs: number }> = []
          
          for (const pdfFile of pdfFiles) {
            const content = pdfFile.content
            
            // 1. Extract B/L No. (like FSHA01261586)
            const blNoMatch = content.match(/B\/L\s*No\.?\s*[:\s]*([A-Z]{4}\d{8,12})/i)
            if (blNoMatch && blNoMatch[1] && !blNo) {
              blNo = blNoMatch[1]
              console.log("[v0] Extracted BL# from BOL:", blNo)
            }
            
            // 2. Extract WHI PO from "Marks and Numbers" section
            // Format: "0000718,8803AMC-0000720" or just "0000720"
            const marksMatch = content.match(/Marks\s*and\s*Numbers[\s\S]{0,100}?(\d{7})/i) ||
                              content.match(/(\d{7}),\d{4}AMC-(\d{7})/i)
            if (marksMatch && !whiPoFromBol) {
              whiPoFromBol = marksMatch[1]
              console.log("[v0] Extracted WHI PO from BOL Marks:", whiPoFromBol)
            }
            
            // 3. Extract Date of Issue as ETD
            const dateMatch = content.match(/Date\s*of\s*Issue[\s\S]{0,30}?(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/i)
            if (dateMatch && dateMatch[1] && !etd) {
              etd = dateMatch[1]
              console.log("[v0] Extracted ETD from BOL:", etd)
            }
            
            // 4. Extract Container table from BOL
            // Format: "VPLU3220052 /EMCQDC5764/20'" or "GCXU6428302 /EMCWKS7294/40H"
            // Followed by PKG (qty), CY-CY, KGS, CBM
            const containerLines = content.match(/([A-Z]{4}\d{7})\s*\/[A-Z0-9]+\/(20'?|40H)\s+(\d+)\s+CY-CY\s+([\d.]+)/gi)
            
            if (containerLines && containerLines.length > 0) {
              console.log("[v0] Found", containerLines.length, "container lines in BOL")
              
              for (const line of containerLines) {
                const match = line.match(/([A-Z]{4}\d{7})\s*\/[A-Z0-9]+\/(20'?|40H)\s+(\d+)\s+CY-CY\s+([\d.]+)/i)
                if (match) {
                  const containerNo = match[1]
                  let containerType = match[2]
                  // Normalize type: 20' -> 20GP, 40H -> 40HQ
                  if (containerType === "20'" || containerType === "20") containerType = "20GP"
                  if (containerType === "40H") containerType = "40HQ"
                  
                  const qty = parseInt(match[3], 10)
                  const kgs = parseFloat(match[4])
                  
                  containerList.push({ container: containerNo, type: containerType, qty, kgs })
                }
              }
              console.log("[v0] Parsed containers:", JSON.stringify(containerList))
            }
          }
          
          // Combine all Excel content from this folder
          let combinedExcelContent = ""
          for (const excelFile of excelFiles) {
            const lines = excelFile.content.split("\n")
            combinedExcelContent += `\n\n=== File: ${excelFile.name} ===\n`
            combinedExcelContent += lines.slice(0, 400).join("\n")
          }
          
          // Build comprehensive BOL info hint with container details
          let blInfoHint = ""
          if (blNo || containerList.length > 0) {
            blInfoHint = `\n=== BOL DATA EXTRACTED FROM PDF ===
BL No.: ${blNo || "not found"}
WHI PO: ${whiPoFromBol || "check Marks and Numbers field"}
ETD/Date of Issue: ${etd || "not found"}

CONTAINER TABLE FROM BOL (${containerList.length} containers):
${containerList.map(c => `- Container: ${c.container}, Type: ${c.type}, PKG: ${c.qty}, KGS: ${c.kgs}`).join("\n")}

IMPORTANT: Use this BOL data for ALL rows. Each container row = one shipment line.
If Excel has SKU details, match them with container data.
If only BOL data, create rows from container table with whiPo="${whiPoFromBol}".
=== END BOL DATA ===`
          }
          
          try {
            // Call Claude with all files from this folder
            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 8192,
              system: SCM_FILE_PROCESSOR_SKILL,
              messages: [
                {
                  role: "user",
                  content: `Parse these Excel files from the same Invoice folder and extract Order Management data as JSON.
Folder path: ${folderKey}
Files in folder: ${folderFiles.map(f => f.name).join(", ")}
IMPORTANT: Use folder path to determine supplier (e.g. AMC folder = AMC supplier)
${blInfoHint}

${combinedExcelContent}`,
                },
              ],
            })

            console.log("[v0] Claude raw response:", JSON.stringify(response.content).substring(0, 300))
            
            const textContent = response.content.find(c => c.type === "text")
            if (textContent && textContent.type === "text") {
              console.log("[v0] Claude response for folder", folderKey, ":", textContent.text.substring(0, 800))
              
              const jsonMatch = textContent.text.match(/```json\n?([\s\S]*?)\n?```/) ||
                               textContent.text.match(/\{[\s\S]*\}/)
              
              if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0]
                
                try {
                  const parsed = JSON.parse(jsonStr)
                  console.log("[v0] Parsed result - skip:", parsed.skip, "rows:", parsed.rows?.length)
                  
                  // Check if folder was skipped
                  if (parsed.skip) {
                    send("progress", { 
                      step: "process", 
                      message: `Skipped: ${folderKey} - ${parsed.reason}`, 
                      percent: 55 + Math.round((processedCount / Math.max(folderKeys.length, 1)) * 40)
                    })
                  } else if (parsed.rows && parsed.rows.length > 0) {
                    allRows.push(...parsed.rows)
                    if (parsed.supplier) {
                      suppliers.add(parsed.supplier)
                    }
                    processedFiles.push(folderKey)
                    send("progress", { 
                      step: "process", 
                      message: `Extracted ${parsed.rows.length} rows from: ${folderKey}`, 
                      percent: 55 + Math.round((processedCount / Math.max(folderKeys.length, 1)) * 40)
                    })
                  } else {
                    send("progress", { 
                      step: "process", 
                      message: `No data found in: ${folderKey}`, 
                      percent: 55 + Math.round((processedCount / Math.max(folderKeys.length, 1)) * 40)
                    })
                  }
                } catch (parseErr) {
                  console.error("[v0] JSON parse error:", parseErr)
                  send("progress", { 
                    step: "process", 
                    message: `JSON parse error: ${folderKey}`, 
                    percent: 55 + Math.round((processedCount / Math.max(folderKeys.length, 1)) * 40)
                  })
                }
              } else {
                send("progress", { 
                  step: "process", 
                  message: `No JSON in response: ${folderKey}`, 
                  percent: 55 + Math.round((processedCount / Math.max(folderKeys.length, 1)) * 40)
                })
              }
            } else {
              send("progress", { 
                step: "process", 
                message: `No text response: ${folderKey}`, 
                percent: 55 + Math.round((processedCount / Math.max(folderKeys.length, 1)) * 40)
              })
            }
          } catch (err) {
            console.error("[v0] Claude error for folder:", folderKey, err)
            send("progress", { 
              step: "process", 
              message: `Error processing: ${folderKey}`, 
              percent: 55 + Math.round((processedCount / Math.max(folderKeys.length, 1)) * 40)
            })
          }
          
          processedCount++
        }

        send("progress", { step: "complete", message: "Deduplicating rows...", percent: 98 })
        
        // Deduplicate rows based on key fields (Invoice + SKU base + Container + Qty)
        const deduplicatedRows: Array<Record<string, unknown>> = []
        const seenKeys = new Set<string>()
        
        for (const row of allRows) {
          // Normalize SKU - remove GT suffix for comparison
          const skuBase = String(row.sku || "").replace(/GT$/i, "").replace(/-[A-Z]$/i, "")
          const key = `${row.supplierInvoice}-${skuBase}-${row.containerNo || ""}-${row.qty}`
          
          if (!seenKeys.has(key)) {
            seenKeys.add(key)
            // Prefer rows with price > 0
            if ((row.unitPrice as number) > 0 || (row.amount as number) > 0) {
              deduplicatedRows.push(row)
            } else {
              // Check if we already have a row with price for this SKU
              const existingWithPrice = deduplicatedRows.find(r => {
                const rSkuBase = String(r.sku || "").replace(/GT$/i, "").replace(/-[A-Z]$/i, "")
                return r.supplierInvoice === row.supplierInvoice && 
                       rSkuBase === skuBase && 
                       r.qty === row.qty &&
                       ((r.unitPrice as number) > 0 || (r.amount as number) > 0)
              })
              if (!existingWithPrice) {
                deduplicatedRows.push(row)
              }
            }
          } else {
            // If duplicate, prefer the one with price
            if ((row.unitPrice as number) > 0 || (row.amount as number) > 0) {
              const existingIdx = deduplicatedRows.findIndex(r => {
                const rSkuBase = String(r.sku || "").replace(/GT$/i, "").replace(/-[A-Z]$/i, "")
                return r.supplierInvoice === row.supplierInvoice && 
                       rSkuBase === skuBase && 
                       r.qty === row.qty
              })
              if (existingIdx >= 0 && (deduplicatedRows[existingIdx].unitPrice as number) === 0) {
                deduplicatedRows[existingIdx] = row
              }
            }
          }
        }
        
        console.log("[v0] Deduplication: ", allRows.length, "->", deduplicatedRows.length)
        
        send("progress", { step: "complete", message: "Sync complete!", percent: 100 })

        send("complete", {
          newRows: deduplicatedRows,
          filesProcessed: processedFiles,
          summary: {
            totalFiles: fileContents.length,
            totalNewRows: deduplicatedRows.length,
            suppliers: Array.from(suppliers),
          },
          debug: `Processed ${processedFiles.length} of ${fileContents.length} files, deduplicated ${allRows.length} -> ${deduplicatedRows.length}`,
        })
        
        controller.close()
      } catch (err) {
        console.error("[v0] Sync error:", err)
        send("error", { error: err instanceof Error ? err.message : "Sync failed" })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
