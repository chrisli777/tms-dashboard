import { NextResponse } from "next/server"
import { generateText, Output } from "ai"
import { z } from "zod"
import { getOneDriveFileContent } from "@/lib/microsoft-graph"

// Schema for parsed PO data
const poItemSchema = z.object({
  sku: z.string().describe("Product SKU or item number"),
  description: z.string().nullable().describe("Product description"),
  qty: z.number().describe("Quantity ordered"),
  unitCost: z.number().describe("Unit cost/price"),
  amount: z.number().describe("Total line amount (qty * unitCost)"),
  weight: z.number().nullable().describe("Weight in kg or lbs if available"),
})

const parsedPOSchema = z.object({
  poNumber: z.string().describe("Purchase Order number"),
  supplier: z.string().describe("Supplier/vendor name"),
  customer: z.string().nullable().describe("Customer name if available"),
  orderDate: z.string().nullable().describe("Order date in YYYY-MM-DD format"),
  dueDate: z.string().nullable().describe("Due/delivery date in YYYY-MM-DD format"),
  items: z.array(poItemSchema).describe("Line items in the PO"),
  totalAmount: z.number().describe("Total PO amount"),
  totalWeight: z.number().nullable().describe("Total weight if available"),
  // BOL info if present (for POs that already have shipment info)
  bolNumber: z.string().nullable().describe("Bill of Lading number if present"),
  containerNumbers: z.array(z.string()).nullable().describe("Container numbers if present"),
  etd: z.string().nullable().describe("Estimated departure date if present"),
  eta: z.string().nullable().describe("Estimated arrival date if present"),
})

export type ParsedPO = z.infer<typeof parsedPOSchema>
export type ParsedPOItem = z.infer<typeof poItemSchema>

export async function POST(request: Request) {
  try {
    const { fileId, userId } = await request.json()

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      )
    }

    // Get file content from OneDrive
    const fileContent = await getOneDriveFileContent(fileId, userId)

    // Determine if it's a PDF or Excel file
    const isPdf = fileContent.mimeType === "application/pdf" || 
                  fileContent.filename.toLowerCase().endsWith(".pdf")
    const isExcel = fileContent.mimeType.includes("spreadsheet") ||
                    fileContent.mimeType.includes("excel") ||
                    fileContent.filename.toLowerCase().endsWith(".xlsx") ||
                    fileContent.filename.toLowerCase().endsWith(".xls") ||
                    fileContent.filename.toLowerCase().endsWith(".csv")

    // Use Claude to extract PO data
    const { output } = await generateText({
      model: "anthropic/claude-sonnet-4-20250514",
      output: Output.object({
        schema: parsedPOSchema,
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the Purchase Order information from this document. 
              
Key fields to extract:
- PO Number (look for "PO#", "Purchase Order", "Order Number", etc.)
- Supplier/Vendor name
- Customer name (may be "WHI" or similar)
- Order date and due/delivery date (format as YYYY-MM-DD)
- All line items with: SKU, description, quantity, unit cost, total amount, weight
- Total PO amount and weight
- If there's any Bill of Lading (BOL) information, container numbers, or shipping dates (ETD/ETA), include those too

For any field that's not present in the document, use null.
Ensure all numeric values are numbers, not strings.`,
            },
            {
              type: "file",
              data: fileContent.data,
              mediaType: isPdf ? "application/pdf" : 
                        isExcel ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :
                        fileContent.mimeType,
              filename: fileContent.filename,
            },
          ],
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
