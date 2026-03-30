import { NextResponse } from "next/server"
import { listOneDriveFiles, searchOneDriveFiles } from "@/lib/microsoft-graph"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get("folderId") || undefined
    const query = searchParams.get("query")
    const userId = searchParams.get("userId") || undefined

    if (query) {
      // Search mode
      const files = await searchOneDriveFiles(query, userId)
      return NextResponse.json({ files, folders: [] })
    }

    // List mode
    const result = await listOneDriveFiles(folderId, userId)
    return NextResponse.json(result)
  } catch (error) {
    console.error("OneDrive files error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list files" },
      { status: 500 }
    )
  }
}
