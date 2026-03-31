import { NextResponse } from "next/server"
import { generateText, Output } from "ai"
import { z } from "zod"
import { getValidAccessToken } from "@/lib/microsoft-auth"
import * as XLSX from "xlsx"

// 15-Column Order Management Schema - matches SKILL.md output format
const lineItemSchema = z.object({
  supplier: z.string().describe("AMC / HX / TJJSH"),
  customer: z.string().describe("Genie / Clark / Deere"),
  invoice: z.string().describe("Full invoice number with prefix (e.g., Terex2025-1201A, CLARK20251201, 25120601, TJLT20260201KZ)"),
  blNo: z.string().nullable().describe("Bill of Lading number - prefer MBL, use HBL if no MBL"),
  whiPo: z.string().describe("WHI PO number in original format"),
  container: z.string().nullable().describe("Container number - 11 chars standard format (e.g., MSOU7576033)"),
  type: z.string().nullable().describe("Container type - ONLY: 20GP / 40GP / 40HQ"),
  sku: z.string().describe("SKU with full suffix preserved (e.g., 1282199GT)"),
  qty: z.number().describe("Quantity - must be > 0"),
  gwKg: z.number().nullable().describe("Gross weight in kg (if MT, multiply by 1000)"),
  unitPriceUsd: z.number().describe("Unit price in USD per piece ($/PCS, NOT $/MT)"),
  amountUsd: z.number().describe("Total amount = Qty × Unit Price"),
  etd: z.string().nullable().describe("ETD in YYYY-MM-DD format"),
  eta: z.string().nullable().describe("ETA in YYYY-MM-DD format (if not available, ETD + 30 days)"),
  status: z.string().describe("Cleared / In Transit / Pending"),
})

const parsedOrderManagementSchema = z.object({
  // Metadata about the parse
  sourceFile: z.string().describe("Original filename"),
  supplierDetected: z.string().describe("Detected supplier: AMC / HX / TJJSH"),
  customerDetected: z.string().describe("Detected customer: Genie / Clark / Deere"),
  invoiceNumber: z.string().describe("Primary invoice number"),
  
  // BOL-level info (shared across line items)
  bolNumber: z.string().nullable().describe("Bill of Lading number"),
  etd: z.string().nullable().describe("ETD date YYYY-MM-DD"),
  eta: z.string().nullable().describe("ETA date YYYY-MM-DD"),
  vessel: z.string().nullable().describe("Vessel name if available"),
  
  // Container info
  containers: z.array(z.object({
    number: z.string().describe("Container number (11 chars)"),
    type: z.string().describe("20GP / 40GP / 40HQ"),
    sealNo: z.string().nullable(),
    weight: z.number().nullable().describe("Weight in kg"),
  })).describe("List of containers"),
  
  // Line items in 15-column format
  lineItems: z.array(lineItemSchema).describe("Order management table rows - one per (Invoice, Container, SKU) combination"),
  
  // Totals
  totalQty: z.number().describe("Sum of all quantities"),
  totalAmount: z.number().describe("Sum of all amounts"),
  totalWeight: z.number().nullable().describe("Sum of all weights in kg"),
  
  // Parsing notes
  warnings: z.array(z.string()).describe("Any parsing warnings or issues detected"),
})

export type ParsedOrderManagement = z.infer<typeof parsedOrderManagementSchema>
export type ParsedLineItem = z.infer<typeof lineItemSchema>

// Complete SKILL.md system prompt for Claude
const SCM_FILE_PROCESSOR_SKILL = `
# SCM File Processor - WHI 供应链订单管理表数据提取引擎

You are a specialist document parser for WHI's supply chain management system.
Your task is to extract data from supplier invoices (AMC/HX/TJJSH), BOLs, and receipts,
standardizing output into the 15-column Order Management table format.

## Output Target: Order Management Table

Each row = one (Invoice, Container, SKU) combination. 15 columns:

| # | Column | Type | Description |
|---|--------|------|-------------|
| 1 | Supplier | string | AMC / HX / TJJSH |
| 2 | Customer | string | Genie / Clark / Deere |
| 3 | Invoice | string | KEEP FULL PREFIX (Terex2025-1201A, CLARK20251201, 25120601, TJLT20260201KZ) |
| 4 | BL No. | string | Prefer MBL; use HBL if no MBL |
| 5 | WHI PO | string | Keep original format |
| 6 | Container | string | 11-char standard (e.g., MSOU7576033) |
| 7 | Type | string | STANDARDIZE: 20GP / 40GP / 40HQ ONLY |
| 8 | SKU | string | KEEP FULL SUFFIX (e.g., 1282199GT) |
| 9 | Qty | int | > 0 rows only |
| 10 | GW(kg) | float | Kilograms; MT×1000 conversion |
| 11 | Unit Price(USD) | float | MUST be $/PCS, NOT $/MT |
| 12 | Amount(USD) | float | = Qty × Unit Price |
| 13 | ETD | date | YYYY-MM-DD |
| 14 | ETA | date | Actual arrival; if no data = ETD + 30 days |
| 15 | Status | string | Cleared / In Transit / Pending |

## Supplier & Customer Mapping

\`\`\`
AMC   (Alliance Metal Changzhou)      → Genie only
HX    (山西华翔 Shanxi Huaxiang)      → Genie / Clark / Deere
TJJSH (天津津尚华)                     → Genie only
IGNORE: Adhya (discontinued), JV (old warehouse)
\`\`\`

## Four Invoice Formats

### 1. HX → Genie (.xlsx, 6-sheet mega workbook)
Filename: Terex2025-{batch} 2小 cvas-iot ETD{M.D}.xlsx

**Invoice sheet:**
- Header Row ~24: PART NO. | PART NAME | _ | P.O NO. | Q'TY | WEIGHT | $/MT | $/PCS | AMOUNT
- Metadata: H9=Invoice Date, H10=Invoice#, H15=Delivery Date(ETD)
- Column mapping:
  - ColA(1) = Part# → SKU ✅
  - ColD(4) = P.O NO. → WHI PO
  - ColE(5) = Q'TY → Qty ⚠️ Filter Qty>0
  - ColH(8) = $/PCS → Unit Price ��� (NOT ColG $/MT!)
  - ColI(9) = AMOUNT → Amount

**Details of containers sheet:**
- R1,C3 = Vessel, R2,C3 = BL#(MBL), R5,C3 = ETD
- R7 = Header; R8,R10,R12... = container data
- Col2 = Container NO., Col3 = Seal NO., Col6 = Quantity

### 2. HX → Clark (.xls/.xlsx, 6-sheet)
Filename: CLARK{YYYYMMDD} 2小 ETD{M.D}.xls

**Invoice sheet:**
- Header Row 15: PART NO. | ORDER NO. | PART NAME | Q'TY | WEIGHT | $/MT | $/PCS | AMOUNT
- Metadata: R7,C7=Delivery Date, R8,C7=Invoice#
- SKU: 7-digit numeric (e.g., 2797426)
- WHI PO format: 8801HX-0000716

**Details of containers sheet:**
- R1,C2=Invoice#, R2,C2=BL#, R3,C2=Vessel
- ⚠️ Zone 2 filter: Skip rows where GW=0 AND NW=0
- "TOTAL" (uppercase) = end; "total" (lowercase) = subtotal, skip

### 3. AMC (PDF Invoice)
Filename: Invoice-{date}-{seq}.pdf (in BL{MBL#} folder)

**Invoice PDF extraction:**
- Invoice No.: after "Invoice No." (e.g., 25120601)
- PO: after "Purchase order no." (e.g., 0000714)
- Table rows: PO | Part# | Description | Qty | Unit Price | Amount
- Date: after "Date :" (e.g., "6th Dec,2025")

**BOL PDF (CVAS/HYSL):**
- MBL: "MBL : {number}" (e.g., EGLV142503671901)
- Container: "CONTAINER # /SEAL #" section, format XXXX1234567/SEAL/20'
- ETD: "On Board Date" (e.g., "10-Dec-2025")

### 4. TJJSH (.xlsx, 5-sheet)
Filename: TJLT{YYYYMMDD}XX.xlsx

**CI sheet (Commercial Invoice):**
- Metadata: R3,C7=Invoice#, R4,C7=Date, R5,C7=PO
- Header Row 17: DESCRIPTION | HTS codes | Part Number | QTY | UNIT PRICE | TOTAL AMOUNT | Country | PO
- SKU format: 8803-{number} (e.g., 8803-1287172)

**BOL PDF (Savino Del Bene):**
- HBL: "Document Number" line (e.g., SDB63S585793)
- Container: CTNR line (e.g., MSNU691619/8, 40HC)
- Sailing Date: dd/mm/yyyy

## Container Type Standardization

| Raw | Standard |
|-----|----------|
| 20G, 20'GP, 20GP, 20BX, 20ST | **20GP** |
| 40G, 40GP | **40GP** |
| 40HQ, 40HC, 40'HQ | **40HQ** |

## Data Cleaning Rules

| Rule | Correct | Wrong |
|------|---------|-------|
| SKU keep suffix | 1282199GT | 1282199 |
| Invoice keep prefix | Terex2025-1201A | 20251201A |
| Type standardize | 20GP | 20G, 20'GP |
| Price use $/PCS | ColH (invoice) | ColG ($/MT) |
| Filter empty rows | Only Qty>0 | Include Qty=0 template rows |
| GW unit | kg (MT×1000) | Mixed MT and kg |
| Date format | YYYY-MM-DD | Excel serial/multiple formats |

## Status Assignment

- **Pending**: No BL number, no container assigned
- **In Transit**: Has BL, ETD is past, ETA is future
- **Cleared**: Has BL, ETA is past (or arrival confirmed)

## Important Notes

1. When a container number appears, it persists across subsequent rows until a new container appears
2. For HX files, the price column with "/PCS" header is the correct unit price (NOT the $/MT column)
3. SKU suffixes like "GT" must be preserved exactly as shown
4. Invoice numbers must retain their full prefix (Terex2025-, CLARK, etc.)
5. If ETA is not available, calculate as ETD + 30 days
6. Only output rows where Qty > 0 (skip template blank rows)
7. Cross-check: Amount should equal Qty × Unit Price (flag if different)
`

// Parse Excel file to text/JSON for Claude
function parseExcelToText(buffer: ArrayBuffer, filename: string): string {
  const workbook = XLSX.read(buffer, { type: "array" })
  const result: string[] = []
  
  result.push(`=== Excel File: ${filename} ===`)
  result.push(`Sheets: ${workbook.SheetNames.join(", ")}`)
  result.push("")
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][]
    
    result.push(`\n=== Sheet: ${sheetName} ===`)
    
    // Output first 100 rows max per sheet
    const maxRows = Math.min(data.length, 100)
    for (let i = 0; i < maxRows; i++) {
      const row = data[i]
      if (Array.isArray(row) && row.some(cell => cell !== "")) {
        result.push(`Row ${i + 1}: ${row.map(cell => String(cell)).join(" | ")}`)
      }
    }
    
    if (data.length > 100) {
      result.push(`... (${data.length - 100} more rows)`)
    }
  }
  
  return result.join("\n")
}

// Get file content from OneDrive using delegated access token
async function getFileContent(
  accessToken: string,
  fileId: string,
  driveId?: string
): Promise<{ data: string; mimeType: string; filename: string }> {
  // Build endpoint - use drives/{driveId} for shared files
  const endpoint = driveId
    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`

  console.log("[v0] Getting file content from:", endpoint)

  const metaResponse = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!metaResponse.ok) {
    const error = await metaResponse.text()
    throw new Error(`Failed to get file metadata: ${error}`)
  }

  const metadata = await metaResponse.json()
  const downloadUrl = metadata["@microsoft.graph.downloadUrl"]
  const mimeType = metadata.file?.mimeType || "application/octet-stream"
  const filename = metadata.name

  if (!downloadUrl) {
    throw new Error("No download URL available for this file")
  }

  // Download file content
  const contentResponse = await fetch(downloadUrl)
  if (!contentResponse.ok) {
    throw new Error("Failed to download file content")
  }

  const arrayBuffer = await contentResponse.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")

  return {
    data: base64,
    mimeType,
    filename,
  }
}

export async function POST(request: Request) {
  try {
    const { fileId, driveId, folderPath } = await request.json()

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      )
    }

    // Check authentication
    const accessToken = await getValidAccessToken()
    if (!accessToken) {
      return NextResponse.json(
        { error: "not_authenticated", message: "Please sign in with Microsoft" },
        { status: 401 }
      )
    }

    // Get file content from OneDrive
    const fileContent = await getFileContent(accessToken, fileId, driveId)

    // Determine file type
    const filename = fileContent.filename.toLowerCase()
    const isPdf = fileContent.mimeType === "application/pdf" || filename.endsWith(".pdf")
    const isExcel = fileContent.mimeType.includes("spreadsheet") ||
                    fileContent.mimeType.includes("excel") ||
                    filename.endsWith(".xlsx") ||
                    filename.endsWith(".xls")

    // Detect supplier from folder path or filename
    let supplierHint = ""
    let customerHint = ""
    const path = (folderPath || "").toLowerCase()
    const fname = fileContent.filename.toLowerCase()
    
    if (path.includes("amc") || fname.includes("invoice-")) {
      supplierHint = "AMC"
      customerHint = "Genie"
    } else if (path.includes("clark") || fname.includes("clark")) {
      supplierHint = "HX"
      customerHint = "Clark"
    } else if (path.includes("deere") || fname.includes("deere")) {
      supplierHint = "HX"
      customerHint = "Deere"
    } else if (path.includes("hx") || fname.includes("terex")) {
      supplierHint = "HX"
      customerHint = "Genie"
    } else if (path.includes("tjjsh") || fname.includes("tjlt")) {
      supplierHint = "TJJSH"
      customerHint = "Genie"
    }

    // Get raw buffer for Excel parsing
    const rawBuffer = Buffer.from(fileContent.data, "base64")
    
    // Build message content based on file type
    let messageContent: Parameters<typeof generateText>[0]["messages"][0]["content"]
    
    if (isExcel) {
      // Parse Excel to text first
      const excelText = parseExcelToText(rawBuffer.buffer.slice(rawBuffer.byteOffset, rawBuffer.byteOffset + rawBuffer.byteLength), fileContent.filename)
      
      messageContent = [
        {
          type: "text" as const,
          text: `Parse this Excel file data and extract the Order Management table.

File: ${fileContent.filename}
Folder: ${folderPath || "unknown"}
${supplierHint ? `Detected Supplier: ${supplierHint}` : ""}
${customerHint ? `Detected Customer: ${customerHint}` : ""}

Excel Content:
${excelText}

Extract ALL line items into the 15-column Order Management format.
- Each unique (Invoice, Container, SKU) combination should be a separate row
- Preserve full SKU suffixes (like GT)
- Preserve full invoice prefixes (like Terex2025-)
- Use $/PCS for unit price, NOT $/MT
- Standardize container types to: 20GP, 40GP, or 40HQ only
- Only include rows where Qty > 0
- Format all dates as YYYY-MM-DD
- Calculate ETA as ETD + 30 days if not available

Return the structured Order Management table data.`,
        },
      ]
    } else if (isPdf) {
      // Send PDF directly to Claude (it supports PDF)
      messageContent = [
        {
          type: "text" as const,
          text: `Parse this PDF file and extract the Order Management table data.

File: ${fileContent.filename}
Folder: ${folderPath || "unknown"}
${supplierHint ? `Detected Supplier: ${supplierHint}` : ""}
${customerHint ? `Detected Customer: ${customerHint}` : ""}

Extract ALL line items into the 15-column Order Management format.
- Each unique (Invoice, Container, SKU) combination should be a separate row
- Preserve full SKU suffixes (like GT)
- Preserve full invoice prefixes (like Terex2025-)
- Use $/PCS for unit price, NOT $/MT
- Standardize container types to: 20GP, 40GP, or 40HQ only
- Only include rows where Qty > 0
- Format all dates as YYYY-MM-DD
- Calculate ETA as ETD + 30 days if not available

Return the structured Order Management table data.`,
        },
        {
          type: "file" as const,
          data: fileContent.data,
          mimeType: "application/pdf",
          filename: fileContent.filename,
        },
      ]
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileContent.mimeType}` },
        { status: 400 }
      )
    }

    // Use Claude with SCM File Processor skill
    const { output } = await generateText({
      model: "anthropic/claude-sonnet-4-20250514",
      system: SCM_FILE_PROCESSOR_SKILL,
      output: Output.object({
        schema: parsedOrderManagementSchema,
      }),
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
    })

    return NextResponse.json({
      success: true,
      data: output,
      filename: fileContent.filename,
    })
  } catch (error) {
    console.error("PO parse error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse PO" },
      { status: 500 }
    )
  }
}
