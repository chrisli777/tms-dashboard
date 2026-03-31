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

        // Download and parse all files
        const fileContents: Array<{ name: string; content: string }> = []
        let downloadedCount = 0

        for (const file of files) {
          try {
            const buffer = await downloadFile(accessToken, file.driveId!, file.id)

            if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) {
              const text = parseExcelToText(buffer, file.name)
              fileContents.push({ name: file.name, content: text })
            } else if (file.name.toLowerCase().endsWith(".pdf")) {
              const base64 = Buffer.from(buffer).toString("base64")
              fileContents.push({ name: file.name, content: `[PDF:${base64}]` })
            }
            
            downloadedCount++
            const percent = 20 + Math.round((downloadedCount / files.length) * 30)
            send("progress", { 
              step: "download", 
              message: `Downloaded ${downloadedCount}/${files.length}: ${file.name}`, 
              percent 
            })
          } catch (err) {
            console.error(`[v0] Failed to process file ${file.name}:`, err)
          }
        }

        send("progress", { step: "process", message: "Processing files with Claude...", percent: 55 })

        // Process files one by one
        const allRows: Array<Record<string, unknown>> = []
        const processedFiles: string[] = []
        const suppliers = new Set<string>()
        let processedCount = 0
        const excelFiles = fileContents.filter(f => !f.content.startsWith("[PDF:"))

        for (const file of excelFiles) {
          const lines = file.content.split("\n")
          const truncatedContent = lines.slice(0, 100).join("\n")
          
          send("progress", { 
            step: "process", 
            message: `Processing: ${file.name}`, 
            percent: 55 + Math.round((processedCount / Math.max(excelFiles.length, 1)) * 40)
          })
          
          try {
            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 8192,
              system: `Use the scm-file-processor skill to process this Excel data and extract order information.
Return JSON only with structure: { "rows": [...], "supplier": "string" }
Each row: { whiPo, supplierInvoice, supplier, customer, containerNo, containerType, blNo, vessel, sku, description, qty, unitPrice, amount, etd, eta }`,
              messages: [
                {
                  role: "user",
                  content: `Process this file: ${file.name}\n\n${truncatedContent}`,
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
                if (parsed.rows) {
                  allRows.push(...parsed.rows)
                }
                if (parsed.supplier) {
                  suppliers.add(parsed.supplier)
                }
                processedFiles.push(file.name)
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
