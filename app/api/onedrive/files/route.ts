import { NextResponse } from "next/server"
import { getValidAccessToken } from "@/lib/microsoft-auth"

export interface OneDriveFile {
  id: string
  name: string
  size: number
  lastModifiedDateTime: string
  webUrl: string
  mimeType?: string
  downloadUrl?: string
  driveId?: string
  remoteItemId?: string
  remoteItemDriveId?: string
}

export interface OneDriveFolder {
  id: string
  name: string
  path: string
  driveId?: string
}

export async function GET(request: Request) {
  try {
    // Check if user is authenticated
    const accessToken = await getValidAccessToken()
    
    if (!accessToken) {
      return NextResponse.json(
        { error: "not_authenticated", message: "Please sign in with Microsoft to access OneDrive files" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get("folderId") || undefined
    const driveId = searchParams.get("driveId") || undefined
    const query = searchParams.get("query")
    const source = searchParams.get("source") || "sharedWithMe" // sharedWithMe or myDrive

    if (query) {
      // Search mode
      const files = await searchFiles(accessToken, query)
      return NextResponse.json({ files, folders: [] })
    }

    // If browsing inside a folder
    if (folderId && driveId) {
      const result = await listFolderContents(accessToken, driveId, folderId)
      return NextResponse.json(result)
    }

    // Root level - list shared with me or my drive
    if (source === "sharedWithMe") {
      const result = await listSharedWithMe(accessToken)
      return NextResponse.json(result)
    } else {
      const result = await listMyDriveRoot(accessToken)
      return NextResponse.json(result)
    }
  } catch (error) {
    console.error("[v0] OneDrive files error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list files" },
      { status: 500 }
    )
  }
}

// List files shared with the current user
async function listSharedWithMe(accessToken: string): Promise<{ files: OneDriveFile[]; folders: OneDriveFolder[] }> {
  const endpoint = "https://graph.microsoft.com/v1.0/me/drive/sharedWithMe"
  
  console.log("[v0] Fetching shared with me files")

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] sharedWithMe error:", error)
    throw new Error(`Failed to list shared files: ${error}`)
  }

  const data = await response.json()
  return parseItems(data.value || [])
}

// List user's own OneDrive root
async function listMyDriveRoot(accessToken: string): Promise<{ files: OneDriveFile[]; folders: OneDriveFolder[] }> {
  const endpoint = "https://graph.microsoft.com/v1.0/me/drive/root/children"
  
  console.log("[v0] Fetching my drive root")

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to list drive files: ${error}`)
  }

  const data = await response.json()
  return parseItems(data.value || [])
}

// List contents of a specific folder (including shared folders)
async function listFolderContents(
  accessToken: string,
  driveId: string,
  folderId: string
): Promise<{ files: OneDriveFile[]; folders: OneDriveFolder[] }> {
  const endpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children`
  
  console.log("[v0] Fetching folder contents:", endpoint)

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to list folder contents: ${error}`)
  }

  const data = await response.json()
  return parseItems(data.value || [], driveId)
}

// Search for files
async function searchFiles(accessToken: string, query: string): Promise<OneDriveFile[]> {
  const endpoint = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')`

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to search files: ${error}`)
  }

  const data = await response.json()
  const { files } = parseItems(data.value || [])
  return files
}

// Parse Graph API response items into files and folders
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
    const itemId = actualItem.id as string
    
    if (actualItem.folder) {
      folders.push({
        id: remoteItem ? (remoteItem.id as string) : (item.id as string),
        name: item.name as string,
        path: parentRef?.path as string || "",
        driveId: driveId,
      })
    } else if (actualItem.file) {
      const name = item.name as string
      // Filter to only PDF and Excel files
      const isPdfOrExcel =
        name.endsWith(".pdf") ||
        name.endsWith(".xlsx") ||
        name.endsWith(".xls") ||
        name.endsWith(".csv")

      if (isPdfOrExcel) {
        const fileInfo = actualItem.file as Record<string, unknown>
        files.push({
          id: remoteItem ? (remoteItem.id as string) : (item.id as string),
          name: name,
          size: actualItem.size as number,
          lastModifiedDateTime: actualItem.lastModifiedDateTime as string,
          webUrl: actualItem.webUrl as string,
          mimeType: fileInfo?.mimeType as string,
          downloadUrl: actualItem["@microsoft.graph.downloadUrl"] as string,
          driveId: driveId,
          remoteItemId: remoteItem ? (remoteItem.id as string) : undefined,
          remoteItemDriveId: remoteItem ? driveId : undefined,
        })
      }
    }
  }

  return { files, folders }
}
