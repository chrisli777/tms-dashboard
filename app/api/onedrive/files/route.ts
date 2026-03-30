import { NextResponse } from "next/server"
import { 
  listSharedWithMe, 
  listSharedFolderContents,
  getSharedFileContent,
  searchOneDriveFiles 
} from "@/lib/microsoft-graph"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get("folderId") || undefined
    const driveId = searchParams.get("driveId") || undefined
    const query = searchParams.get("query")
    const mode = searchParams.get("mode") || "shared" // default to shared

    console.log("[v0] OneDrive request - mode:", mode, "folderId:", folderId, "driveId:", driveId)

    if (query) {
      // Search mode
      const files = await searchOneDriveFiles(query)
      return NextResponse.json({ files, folders: [] })
    }

    if (folderId && driveId) {
      // Browse inside a shared folder
      const result = await listSharedFolderContents(folderId, driveId)
      return NextResponse.json(result)
    }

    // Default: List "Shared with me" items
    const result = await listSharedWithMe()
    return NextResponse.json(result)
  } catch (error) {
    console.error("OneDrive files error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list files" },
      { status: 500 }
    )
  }
}

// Get file content
export async function POST(request: Request) {
  try {
    const { fileId, driveId } = await request.json()
    
    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 })
    }

    console.log("[v0] Getting file content - fileId:", fileId, "driveId:", driveId)

    const content = await getSharedFileContent(fileId, driveId)
    return NextResponse.json(content)
  } catch (error) {
    console.error("OneDrive file content error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get file content" },
      { status: 500 }
    )
  }
}
