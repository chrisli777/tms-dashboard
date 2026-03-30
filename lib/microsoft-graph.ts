// Microsoft Graph API client for OneDrive integration
import { ConfidentialClientApplication } from "@azure/msal-node"

// TEMPORARY: Hardcoded credentials to bypass env var caching issue
// TODO: Revert to env vars once caching is resolved
const HARDCODED_TENANT_ID = "3ca75e96-5bb7-49da-8836-e47210951589"
const HARDCODED_CLIENT_ID = "533c767d-c6f2-4eff-8086-c4afcb6447e8"
const HARDCODED_CLIENT_SECRET = "gzh8Q~GMus~t5iJdO1UVxvPsJOXThl66yE0lscv~"
const DEFAULT_USER_EMAIL = "chris.li@whcast.com"

function getMsalClient(): ConfidentialClientApplication {
  const tenantId = HARDCODED_TENANT_ID
  const clientId = HARDCODED_CLIENT_ID
  const clientSecret = HARDCODED_CLIENT_SECRET

  console.log("[v0] MSAL Using - Tenant:", tenantId, "Client:", clientId?.substring(0, 8))

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing Microsoft credentials. Please set MICROSOFT_CLIENT_SECRET environment variable.")
  }

  const msalConfig = {
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  }

  return new ConfidentialClientApplication(msalConfig)
}

async function getAccessToken(): Promise<string> {
  const cca = getMsalClient()
  const result = await cca.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  })
  if (!result?.accessToken) {
    throw new Error("Failed to acquire access token")
  }
  return result.accessToken
}

export interface OneDriveFile {
  id: string
  name: string
  size: number
  lastModifiedDateTime: string
  webUrl: string
  mimeType?: string
  downloadUrl?: string
  // For shared files
  remoteItemId?: string
  remoteItemDriveId?: string
  driveId?: string
}

export interface OneDriveFolder {
  id: string
  name: string
  path: string
  driveId?: string
  files: OneDriveFile[]
  folders: OneDriveFolder[]
}

// List files in a specific folder
export async function listOneDriveFiles(
  folderId?: string,
  userId?: string
): Promise<{ files: OneDriveFile[]; folders: OneDriveFolder[] }> {
  const token = await getAccessToken()
  
  // Use default user email for application-only auth
  const user = userId || DEFAULT_USER_EMAIL
  
  // Build endpoint for specified user
  const endpoint = folderId
    ? `https://graph.microsoft.com/v1.0/users/${user}/drive/items/${folderId}/children`
    : `https://graph.microsoft.com/v1.0/users/${user}/drive/root/children`
  
  console.log("[v0] OneDrive endpoint:", endpoint)

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to list OneDrive files: ${error}`)
  }

  const data = await response.json()
  const items = data.value || []

  const files: OneDriveFile[] = []
  const folders: OneDriveFolder[] = []

  for (const item of items) {
    if (item.folder) {
      folders.push({
        id: item.id,
        name: item.name,
        path: item.parentReference?.path || "",
        files: [],
        folders: [],
      })
    } else if (item.file) {
      // Filter to only PDF and Excel files
      const isPdfOrExcel =
        item.name.endsWith(".pdf") ||
        item.name.endsWith(".xlsx") ||
        item.name.endsWith(".xls") ||
        item.name.endsWith(".csv")

      if (isPdfOrExcel) {
        files.push({
          id: item.id,
          name: item.name,
          size: item.size,
          lastModifiedDateTime: item.lastModifiedDateTime,
          webUrl: item.webUrl,
          mimeType: item.file.mimeType,
          downloadUrl: item["@microsoft.graph.downloadUrl"],
        })
      }
    }
  }

  return { files, folders }
}

// Get file content as base64
export async function getOneDriveFileContent(
  fileId: string,
  userId?: string
): Promise<{ data: string; mimeType: string; filename: string }> {
  const token = await getAccessToken()
  
  // Use default user email for application-only auth
  const user = userId || DEFAULT_USER_EMAIL

  // First get file metadata
  const metaEndpoint = `https://graph.microsoft.com/v1.0/users/${user}/drive/items/${fileId}`

  const metaResponse = await fetch(metaEndpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!metaResponse.ok) {
    throw new Error("Failed to get file metadata")
  }

  const metadata = await metaResponse.json()
  const downloadUrl = metadata["@microsoft.graph.downloadUrl"]
  const mimeType = metadata.file?.mimeType || "application/octet-stream"
  const filename = metadata.name

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

// List files shared with the user
export async function listSharedWithMe(
  userId?: string
): Promise<{ files: OneDriveFile[]; folders: OneDriveFolder[] }> {
  const token = await getAccessToken()
  
  // Use default user email for application-only auth
  const user = userId || DEFAULT_USER_EMAIL
  
  // Get items shared with this user
  const endpoint = `https://graph.microsoft.com/v1.0/users/${user}/drive/sharedWithMe`
  
  console.log("[v0] Shared with me endpoint:", endpoint)

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to list shared files: ${error}`)
  }

  const data = await response.json()
  const items = data.value || []

  const files: OneDriveFile[] = []
  const folders: OneDriveFolder[] = []

  for (const item of items) {
    if (item.folder) {
      folders.push({
        id: item.id,
        name: item.name,
        path: item.parentReference?.path || "",
        files: [],
        folders: [],
      })
    } else if (item.file) {
      // Filter to only PDF and Excel files
      const isPdfOrExcel =
        item.name.endsWith(".pdf") ||
        item.name.endsWith(".xlsx") ||
        item.name.endsWith(".xls") ||
        item.name.endsWith(".csv")

      if (isPdfOrExcel) {
        files.push({
          id: item.id,
          name: item.name,
          size: item.size,
          lastModifiedDateTime: item.lastModifiedDateTime,
          webUrl: item.webUrl,
          mimeType: item.file.mimeType,
          downloadUrl: item["@microsoft.graph.downloadUrl"],
          // Store remote item info for shared files
          remoteItemId: item.remoteItem?.id,
          remoteItemDriveId: item.remoteItem?.parentReference?.driveId,
        })
      }
    }
  }

  return { files, folders }
}

// Get content of a shared file (needs special handling for remote items)
export async function getSharedFileContent(
  fileId: string,
  driveId?: string,
  userId?: string
): Promise<{ data: string; mimeType: string; filename: string }> {
  const token = await getAccessToken()
  
  // For shared files, we need to use the drive ID of the shared item
  const endpoint = driveId
    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}`
    : `https://graph.microsoft.com/v1.0/users/${userId || DEFAULT_USER_EMAIL}/drive/items/${fileId}`

  console.log("[v0] Getting shared file:", endpoint)

  const metaResponse = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!metaResponse.ok) {
    const error = await metaResponse.text()
    throw new Error(`Failed to get shared file metadata: ${error}`)
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
    throw new Error("Failed to download shared file content")
  }

  const arrayBuffer = await contentResponse.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")

  return {
    data: base64,
    mimeType,
    filename,
  }
}

// List contents of a shared folder
export async function listSharedFolderContents(
  folderId: string,
  driveId: string
): Promise<{ files: OneDriveFile[]; folders: OneDriveFolder[] }> {
  const token = await getAccessToken()
  
  const endpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children`
  
  console.log("[v0] Listing shared folder:", endpoint)

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to list shared folder: ${error}`)
  }

  const data = await response.json()
  const items = data.value || []

  const files: OneDriveFile[] = []
  const folders: OneDriveFolder[] = []

  for (const item of items) {
    if (item.folder) {
      folders.push({
        id: item.id,
        name: item.name,
        path: item.parentReference?.path || "",
        driveId: item.parentReference?.driveId || driveId,
        files: [],
        folders: [],
      })
    } else if (item.file) {
      const isPdfOrExcel =
        item.name.endsWith(".pdf") ||
        item.name.endsWith(".xlsx") ||
        item.name.endsWith(".xls") ||
        item.name.endsWith(".csv")

      if (isPdfOrExcel) {
        files.push({
          id: item.id,
          name: item.name,
          size: item.size,
          lastModifiedDateTime: item.lastModifiedDateTime,
          webUrl: item.webUrl,
          mimeType: item.file.mimeType,
          downloadUrl: item["@microsoft.graph.downloadUrl"],
          driveId: item.parentReference?.driveId || driveId,
        })
      }
    }
  }

  return { files, folders }
}

// Search for PO files by name pattern
export async function searchOneDriveFiles(
  query: string,
  userId?: string
): Promise<OneDriveFile[]> {
  const token = await getAccessToken()
  
  // Use default user email for application-only auth
  const user = userId || DEFAULT_USER_EMAIL

  const endpoint = `https://graph.microsoft.com/v1.0/users/${user}/drive/root/search(q='${encodeURIComponent(query)}')`

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to search OneDrive: ${error}`)
  }

  const data = await response.json()
  const items = data.value || []

  return items
    .filter((item: Record<string, unknown>) => {
      const name = item.name as string
      return (
        item.file &&
        (name.endsWith(".pdf") ||
          name.endsWith(".xlsx") ||
          name.endsWith(".xls") ||
          name.endsWith(".csv"))
      )
    })
    .map((item: Record<string, unknown>) => ({
      id: item.id as string,
      name: item.name as string,
      size: item.size as number,
      lastModifiedDateTime: item.lastModifiedDateTime as string,
      webUrl: item.webUrl as string,
      mimeType: (item.file as Record<string, unknown>)?.mimeType as string,
      downloadUrl: item["@microsoft.graph.downloadUrl"] as string,
    }))
}
