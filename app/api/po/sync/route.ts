import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getValidAccessToken } from "@/lib/microsoft-auth"
import * as XLSX from "xlsx"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// SCM File Processor Skill - embedded from Claude Console (complete version)
const SCM_FILE_PROCESSOR_SKILL = `# SCM File Processor

WHI 供应链数据中台的入口。所有供应商文件经本 Skill 解析后输出统一的 Order Management 表。

## 供应商识别 (从文件名判断)

**关键规则**: 根据文件名前缀判断供应商:
- 文件名含 "AMC" → supplier="AMC", customer="Genie"
- 文件名含 "Terex" → supplier="HX", customer="Genie"
- 文件名含 "CLARK" → supplier="HX", customer="Clark"
- 文件名含 "TJLT" → supplier="TJJSH", customer="Genie"

## 输出目标: Order Management 表

每行 = 一个 (Invoice, Container, SKU) 组合。15 列：

| # | 列名 | 类型 | 说明 |
|---|------|------|------|
| 1 | Supplier | string | AMC / HX / TJJSH (根据文件名判断) |
| 2 | Customer | string | Genie / Clark / Deere |
| 3 | Invoice | string | 保留完整前缀 |
| 4 | BL No. | string | 优先 MBL |
| 5 | WHI PO | string | 原始格式 |
| 6 | Container | string | 11位格式 |
| 7 | Type | string | 20GP / 40GP / 40HQ only |
| 8 | SKU | string | 保留后缀 |
| 9 | Qty | int | > 0 才输出 |
| 10 | GW(kg) | float | MT×1000 |
| 11 | Unit Price(USD) | float | $/PCS |
| 12 | Amount(USD) | float | Qty × Price |
| 13 | ETD | date | YYYY-MM-DD |
| 14 | ETA | date | ETD + 30天 |
| 15 | Status | string | Cleared / In Transit / Pending |

## 1. AMC (Excel 发票)

**文件名**: AMC{YYYY}-{MMDD}... 或含 "AMC" 的 Excel

**读取规则**:
- 找 "invoice" sheet 或第一个 sheet
- 扫描找到包含 "Part" 或 "PN" 和 "Qty" 的 header 行
- 列映射: Part#→SKU, PO→WHI PO, Qty, Unit Price($/PCS), Amount
- Invoice# 从文件名或 sheet 中提取 (如 "AMC2026-0301")
- **supplier="AMC", customer="Genie"**

## 2. HX → Genie (.xlsx)

**文件名**: Terex{YYYY}-{batch}...

**读 invoice sheet:**
- Header 在 ~Row 24: PART NO. | PART NAME | P.O NO. | Q'TY | $/MT | $/PCS | AMOUNT
- 列映射: ColA→SKU, ColD→WHI PO, ColE→Qty, ColH→$/PCS(不是$/MT!), ColI→Amount
- Invoice# 从 H10 或文件名

**读 details of containers sheet:**
- R1,C3=Vessel, R2,C3=BL#, R5,C3=ETD
- R8+ = Container NO.(Col2), Type(从文本判断20GP/40GP/40HQ)
- **supplier="HX", customer="Genie"**

## 3. HX → Clark (.xls)

**文件名**: CLARK{YYYYMMDD}...

**读 Invoice sheet:**
- Header Row 15: PART NO. | ORDER NO. | Q'TY | $/PCS | AMOUNT
- 列映射: C1→SKU, C2→WHI PO, C4→Qty, C7→$/PCS, C8→Amount
- Invoice# 从 R8,C7

**读 details of containers sheet:**
- R2,C2=BL#, R3,C2=Vessel
- R7+ = Container 数据
- **supplier="HX", customer="Clark"**

## 4. TJJSH (.xlsx)

**文件名**: TJLT{YYYYMMDD}...

**读 CI sheet:**
- R3,C7=Invoice#
- Header Row 17: Part Number | QTY | UNIT PRICE | AMOUNT | PO
- 列映射: C4→SKU, C5→Qty, C6→$/PCS, C7→Amount, C9→WHI PO
- **supplier="TJJSH", customer="Genie"**

## 输出格式

返回 JSON (supplier 必须根据文件名正确设置):
{
  "rows": [
    {
      "supplier": "AMC",  // 文件名含AMC则为AMC，含Terex则为HX，含CLARK则为HX，含TJLT则为TJJSH
      "customer": "Genie",
      "supplierInvoice": "AMC2026-0301",
      "blNo": "",
      "whiPo": "0000728",
      "containerNo": "",
      "containerType": "",
      "sku": "1260198-A",
      "qty": 120,
      "gw": 0,
      "unitPrice": 5.50,
      "amount": 660.00,
      "etd": "",
      "eta": "",
      "status": "Pending"
    }
  ],
  "supplier": "AMC",
  "filesProcessed": ["AMC2026-0301 3.11 8小6大 DOC.(1)(3).xlsx"]
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
