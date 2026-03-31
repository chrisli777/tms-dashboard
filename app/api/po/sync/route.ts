import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getValidAccessToken } from "@/lib/microsoft-auth"
import * as XLSX from "xlsx"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// SCM File Processor Skill - complete version from supplier_formats.md
const SCM_FILE_PROCESSOR_SKILL = `# SCM File Processor

Parse supplier shipment files into unified 15-column Order Management table.

## Supplier Detection (from filename)

- Filename contains "AMC" → supplier="AMC", customer="Genie"
- Filename contains "Terex" → supplier="HX", customer="Genie"  
- Filename contains "CLARK" → supplier="HX", customer="Clark"
- Filename contains "TJLT" → supplier="TJJSH", customer="Genie"

## Output: 15-Column Table

| Column | Type | Notes |
|--------|------|-------|
| Supplier | string | AMC / HX / TJJSH |
| Customer | string | Genie / Clark / Deere |
| Invoice | string | Full prefix preserved |
| BL No. | string | MBL preferred |
| WHI PO | string | Original format |
| Container | string | 4 letters + 7 digits (e.g. MSOU7576033) |
| Type | string | 20GP / 40GP / 40HQ ONLY |
| SKU | string | Numeric only, NO letter suffix (e.g. 1260198 NOT 1260198-A) |
| Qty | int | > 0 only |
| GW(kg) | float | MT × 1000 |
| Unit Price(USD) | float | $/PCS (never $/MT) |
| Amount(USD) | float | Qty × Price |
| ETD | date | YYYY-MM-DD |
| ETA | date | ETD + 30 days if unavailable |
| Status | string | Cleared / In Transit / Pending |

## 1. AMC (Excel Invoice)

**Filename**: AMC{YYYY}-{MMDD}... or contains "AMC"
**supplier="AMC", customer="Genie"**

**Parsing Rules**:
- Find "invoice" sheet or first sheet
- Scan for header row containing "Part" or "PN" AND "Qty"
- Column mapping: Part# → SKU (numeric only, strip -A/-B/-C suffix), PO → WHI PO, Qty, Unit Price ($/PCS), Amount
- Invoice# from filename (e.g. "AMC2026-0301")
- Look for container info in "details of containers" sheet if exists

## 2. HX-Genie (.xlsx)

**Filename**: Terex{YYYY}-{batch}...
**supplier="HX", customer="Genie"**

**Invoice Sheet** (dynamic header scan):
- Scan rows 1-50 for header containing "PART" AND "Q'TY"
- Find $/PCS column (look for "/PCS" in sub-header row)
- Column mapping: Col A → SKU (with GT suffix if present), Col D → WHI PO, $/PCS col → Unit Price (NOT $/MT!)
- Invoice# from metadata rows above header

**Details of Containers Sheet**:
- R1,C3 = Vessel, R2,C3 = BL# (MBL), R5,C3 = ETD
- R7 = Header, R8+ = Container data
- Col 2 = Container NO. (11 chars: 4 letters + 7 digits)
- Type: contains "20" → 20GP, contains "40" + "H"/"HQ" → 40HQ, else → 40GP

## 3. HX-Clark (.xls/.xlsx)

**Filename**: CLARK{YYYYMMDD}...
**supplier="HX", customer="Clark"**

**Invoice Sheet**:
- Header Row 15: PART NO. | ORDER NO. | Q'TY | $/PCS | AMOUNT
- R7,C7 = Delivery Date (ETD), R8,C7 = Invoice#
- Column mapping: C1 → SKU (7-digit, no GT suffix), C2 → WHI PO, C4 → Qty, C7 → $/PCS, C8 → Amount

**Details of Containers Sheet**:
- R1,C2 = Invoice#, R2,C2 = BL#, R3,C2 = Vessel
- R7+ = Container data (one container spans multiple SKU rows)
- Skip rows where GW=0 AND NW=0

## 4. TJJSH (.xlsx)

**Filename**: TJLT{YYYYMMDD}...
**supplier="TJJSH", customer="Genie"**

**CI Sheet** (Commercial Invoice):
- R3,C7 = Invoice#, R4,C7 = Date, R5,C7 = PO
- Header Row 17: C4=Part Number, C5=QTY, C6=UNIT PRICE, C7=AMOUNT, C9=PO
- SKU format: 8803-{number} (no GT suffix)

## Container Type Standardization

| Raw | Standard |
|-----|----------|
| 20G, 20'GP, 20GP, 20BX, 20ST | **20GP** |
| 40G, 40GP | **40GP** |
| 40HQ, 40HC, 40'HQ | **40HQ** |

## SKU Cleanup Rules

- Remove letter suffixes: 1260198-A → 1260198, 132383-C → 132383
- Keep GT suffix for HX-Genie: 1282199GT stays as 1282199GT
- Format: numeric only (except GT suffix for HX)

## Output JSON

{
  "rows": [
    {
      "supplier": "AMC",
      "customer": "Genie",
      "supplierInvoice": "AMC2026-0301",
      "blNo": "COSU6437079380",
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
}

interface OneDriveFolder {
  id: string
  name: string
  driveId?: string
}

// Get ALL files from OneDrive (both my files and shared with me)
async function getAllOneDriveFiles(accessToken: string): Promise<OneDriveFile[]> {
  const allFiles: OneDriveFile[] = []

  // 1. Get files shared with me
  try {
    const sharedResult = await listSharedWithMe(accessToken)
    allFiles.push(...sharedResult.files)
    
    // Scan shared folders
    for (const folder of sharedResult.folders) {
      if (folder.driveId && folder.id) {
        const folderFiles = await getAllFilesInFolder(accessToken, folder.driveId, folder.id)
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
    
    // Scan my folders
    for (const folder of myFilesResult.folders) {
      if (folder.driveId && folder.id) {
        const folderFiles = await getAllFilesInFolder(accessToken, folder.driveId, folder.id)
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

// Pre-filter files by name pattern - per skill definition (any format allowed)
function isPotentialPOFile(filename: string): boolean {
  const name = filename.toLowerCase()
  
  // HX → Genie: file contains "terex"
  if (name.includes("terex")) return true
  
  // HX → Clark: file contains "clark"
  if (name.includes("clark")) return true
  
  // TJJSH: file contains "tjlt"
  if (name.includes("tjlt")) return true
  
  // AMC: file contains "amc"
  if (name.includes("amc")) return true
  
  // All other files are skipped
  return false
}

// Parse Excel to text
function parseExcelToText(buffer: ArrayBuffer, filename: string): string {
  const workbook = XLSX.read(buffer, { type: "array" })
  const result: string[] = []

  result.push(`=== File: ${filename} ===`)
  result.push(`Sheets: ${workbook.SheetNames.join(", ")}`)

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

        // Pre-filter files by name pattern, then download
        const potentialPOFiles = files.filter(f => isPotentialPOFile(f.name))
        const skippedCount = files.length - potentialPOFiles.length
        
        send("progress", { 
          step: "download", 
          message: `Found ${potentialPOFiles.length} potential PO files (skipped ${skippedCount} unrelated)`, 
          percent: 25
        })

        const fileContents: Array<{ name: string; content: string }> = []
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
              fileContents.push({ name: file.name, content: text })
            } else if (file.name.toLowerCase().endsWith(".pdf")) {
              const base64 = Buffer.from(buffer).toString("base64")
              fileContents.push({ name: file.name, content: `[PDF:${base64}]` })
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

        send("progress", { step: "process", message: "Processing files with Claude scm-file-processor skill...", percent: 55 })

        // Process files one by one using the skill
        const allRows: Array<Record<string, unknown>> = []
        const processedFiles: string[] = []
        const suppliers = new Set<string>()
        let processedCount = 0
        // Skip PDFs for now, focus on Excel (skill handles PDF differently)
        const excelFiles = fileContents.filter(f => !f.content.startsWith("[PDF:"))

        for (const file of excelFiles) {
          const lines = file.content.split("\n")
          const truncatedContent = lines.slice(0, 150).join("\n")
          
          send("progress", { 
            step: "process", 
            message: `Processing: ${file.name}`, 
            percent: 55 + Math.round((processedCount / Math.max(excelFiles.length, 1)) * 40)
          })
          
          try {
            // Call Claude with embedded scm-file-processor skill
            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 8192,
              system: SCM_FILE_PROCESSOR_SKILL,
              messages: [
                {
                  role: "user",
                  content: `Parse this file and extract Order Management data as JSON:\n\n${truncatedContent}`,
                },
              ],
            })

            const textContent = response.content.find(c => c.type === "text")
            if (textContent && textContent.type === "text") {
              console.log("[v0] Claude response for", file.name, ":", textContent.text.substring(0, 500))
              
              const jsonMatch = textContent.text.match(/```json\n?([\s\S]*?)\n?```/) ||
                               textContent.text.match(/\{[\s\S]*\}/)
              
              console.log("[v0] JSON match:", jsonMatch ? "found" : "not found")
              
              if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0]
                console.log("[v0] Parsing JSON:", jsonStr.substring(0, 200))
                
                try {
                  const parsed = JSON.parse(jsonStr)
                  console.log("[v0] Parsed result - skip:", parsed.skip, "rows:", parsed.rows?.length)
                  
                  // Check if file was skipped
                  if (parsed.skip) {
                    send("progress", { 
                      step: "process", 
                      message: `Skipped: ${file.name} (${parsed.reason})`, 
                      percent: 55 + Math.round((processedCount / Math.max(excelFiles.length, 1)) * 40)
                    })
                  } else if (parsed.rows && parsed.rows.length > 0) {
                    allRows.push(...parsed.rows)
                    if (parsed.supplier) {
                      suppliers.add(parsed.supplier)
                    }
                    processedFiles.push(file.name)
                    send("progress", { 
                      step: "process", 
                      message: `Extracted ${parsed.rows.length} rows from: ${file.name}`, 
                      percent: 55 + Math.round((processedCount / Math.max(excelFiles.length, 1)) * 40)
                    })
                  } else {
                    console.log("[v0] No rows in response for", file.name)
                  }
                } catch (parseErr) {
                  console.error("[v0] JSON parse error:", parseErr, "for string:", jsonStr.substring(0, 100))
                }
              } else {
                console.log("[v0] No JSON found in response for", file.name)
              }
            } else {
              console.log("[v0] No text content in response for", file.name)
            }
          } catch (err) {
            console.error("[v0] Claude error for:", file.name, err)
            send("progress", { 
              step: "process", 
              message: `Error processing: ${file.name}`, 
              percent: 55 + Math.round((processedCount / Math.max(excelFiles.length, 1)) * 40)
            })
          }
          
          processedCount++
        }

        send("progress", { step: "complete", message: "Sync complete!", percent: 100 })

        send("complete", {
          newRows: allRows,
          filesProcessed: processedFiles,
          summary: {
            totalFiles: fileContents.length,
            totalNewRows: allRows.length,
            suppliers: Array.from(suppliers),
          },
          debug: `Processed ${processedFiles.length} of ${fileContents.length} files`,
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
