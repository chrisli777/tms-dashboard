import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getValidAccessToken } from "@/lib/microsoft-auth"
import * as XLSX from "xlsx"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// SCM File Processor Skill - embedded from Claude Console
const SCM_FILE_PROCESSOR_SKILL = `# SCM File Processor

WHI 供应链数据中台的入口。所有供应商文件经本 Skill 解析后输出统一的 Order Management 表。

## 文件类型检测

首先判断文件是否为有效的 PO/Invoice 文件：
1. **HX→Genie (.xlsx)**: 有 "invoice" 和 "details of containers" 两个 sheet
2. **HX→Clark (.xls)**: 有 "Invoice" sheet，文件名含 "CLARK"
3. **TJJSH (.xlsx)**: 文件名含 "TJLT"
4. **AMC (PDF)**: 含 invoice number 格式如 "25120601"

如果文件不匹配任何模式，返回: {"skip": true, "reason": "Not a recognized PO/Invoice file"}

## 输出目标: Order Management 表

每行 = 一个 (Invoice, Container, SKU) 组合。15 列：

| # | 列名 | 类型 | 说明 |
|---|------|------|------|
| 1 | Supplier | string | AMC / HX / TJJSH |
| 2 | Customer | string | Genie / Clark / Deere |
| 3 | Invoice | string | 保留完整前缀 (Terex2025-1201A, CLARK20251201, 25120601, TJLT20260201KZ) |
| 4 | BL No. | string | 优先 MBL; 无 MBL 时用 HBL |
| 5 | WHI PO | string | 保留各供应商原始格式 |
| 6 | Container | string | 11位标准格式 (如 MSOU7576033) |
| 7 | Type | string | 标准化: 20GP / 40GP / 40HQ only |
| 8 | SKU | string | 保留完整编号含后缀 (如 1282199GT) |
| 9 | Qty | int | > 0 的行才输出 |
| 10 | GW(kg) | float | 千克; MT×1000 转换 |
| 11 | Unit Price(USD) | float | 必须 $/PCS, 不是 $/MT |
| 12 | Amount(USD) | float | = Qty × Unit Price |
| 13 | ETD | date | YYYY-MM-DD |
| 14 | ETA | date | 实际到港; 无数据时 = ETD + 30天 |
| 15 | Status | string | Cleared / In Transit / Pending |

## 供应商与客户映射

- AMC (Alliance Metal Changzhou) → Genie only
- HX (山西华翔 Shanxi Huaxiang) → Genie / Clark / Deere
- TJJSH (天津津尚华) → Genie only
- 忽略: Adhya (已停), JV (旧仓库)

## HX → Genie (.xlsx, 6-sheet mega workbook)

文件名: Terex2025-{batch} 2小 cvas-iot ETD{M.D}.xlsx

**读 invoice sheet (主数据):**
- 元数据: H9=Invoice Date, H10=Invoice#, H15=Delivery Date(ETD)
- Header Row 24: PART NO. | PART NAME | _ | P.O NO. | Q'TY | WEIGHT | $/MT | $/PCS | AMOUNT
- 列映射:
  - ColA(1) = Part# → SKU (保留后缀如GT)
  - ColD(4) = P.O NO. → WHI PO
  - ColE(5) = Q'TY → Qty (过滤 Qty>0)
  - ColH(8) = $/PCS → Unit Price (不是ColG的$/MT!)
  - ColI(9) = AMOUNT → Amount

**读 details of containers sheet:**
- R1,C3 = Vessel, R2,C3 = BL#(MBL), R5,C3 = ETD
- R7 = Header; R8,R10,R12... = 柜数据
- Col2 = Container NO., Col3 = Seal NO., Col6 = Quantity
- 柜型检测: 含"20"→20GP, 含"40"且含"H"或"HQ"→40HQ, 否则→40GP

## HX → Clark (.xls, 6-sheet)

文件名: CLARK{YYYYMMDD} 2小 ETD{M.D}.xls

**读 Invoice sheet:**
- Header Row 15: C1=PART NO. C2=ORDER NO. C3=PART NAME C4=Q'TY C5=WEIGHT C6=$/MT C7=$/PCS C8=AMOUNT
- 元数据: R7,C7=Delivery Date, R8,C7=Invoice#
- 列映射: C1→SKU, C2→WHI PO, C4→Qty, C7→$/PCS, C8→Amount

**读 details of containers sheet:**
- R1,C2 = Invoice#, R2,C2 = BL#, R3,C2 = Vessel
- R7+ = 柜数据 (Container列只在首行出现)
- 过滤: 跳过 GW=0 且 NW=0 的行

## TJJSH (.xlsx, 5-sheet)

文件名: TJLT{YYYYMMDD}XX.xlsx

**读 CI sheet (Commercial Invoice):**
- 元数据: R3,C7=Invoice#, R4,C7=Date, R5,C7=PO
- Header Row 17: C2=DESCRIPTION C4=Part Number C5=QTY C6=UNIT PRICE C7=TOTAL AMOUNT C9=PO
- 列映射: C4→SKU (格式: 8803-1287172), C5→Qty, C6→$/PCS, C7→Amount, C9→WHI PO

## 数据清洗规则

| 规则 | 正确 | 错误 |
|------|------|------|
| SKU保留后缀 | 1282199GT | 1282199 |
| Invoice保留前缀 | Terex2025-1201A | 20251201A |
| Type标准化 | 20GP, 40GP, 40HQ | 20G, 20'GP, 40HC |
| Price用$/PCS | ColH(invoice) | ColG($/MT) |
| 过滤空行 | Qty>0才输出 | 输出Qty=0的模板行 |
| 日期格式 | YYYY-MM-DD | Excel serial/多格式 |

## 输出格式

返回 JSON:
{
  "rows": [
    {
      "supplier": "HX",
      "customer": "Genie",
      "supplierInvoice": "Terex2025-1201A",
      "blNo": "COSU6437079380",
      "whiPo": "0000714",
      "containerNo": "MSOU7576033",
      "containerType": "40HQ",
      "sku": "1282199GT",
      "qty": 100,
      "gw": 1500.5,
      "unitPrice": 12.50,
      "amount": 1250.00,
      "etd": "2025-12-06",
      "eta": "2026-01-05",
      "status": "In Transit"
    }
  ],
  "supplier": "HX",
  "filesProcessed": ["filename.xlsx"]
}

如果文件不是有效的 PO/Invoice，返回:
{"skip": true, "reason": "描述原因"}
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

// Pre-filter files by name pattern - per skill definition:
// 1. HX→Genie (.xlsx): 有 "invoice" 和 "details of containers" sheet，文件名含 "Terex"
// 2. HX→Clark (.xls): 文件名含 "CLARK"
// 3. TJJSH (.xlsx): 文件名含 "TJLT"
// 4. AMC (PDF): 含 invoice number 格式如 "25120601"
function isPotentialPOFile(filename: string): boolean {
  const name = filename.toLowerCase()
  
  // HX → Genie (.xlsx): file contains "terex"
  if (name.includes("terex") && name.endsWith(".xlsx")) return true
  
  // HX → Clark (.xls): file contains "clark"
  if (name.includes("clark") && name.endsWith(".xls")) return true
  
  // TJJSH (.xlsx): file contains "tjlt"
  if (name.includes("tjlt") && name.endsWith(".xlsx")) return true
  
  // AMC (PDF): contains 8-digit invoice number like "25120601"
  if (name.endsWith(".pdf") && /\d{8}/.test(name)) return true
  
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
              const jsonMatch = textContent.text.match(/```json\n?([\s\S]*?)\n?```/) ||
                               textContent.text.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0]
                const parsed = JSON.parse(jsonStr)
                
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
                }
              }
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
