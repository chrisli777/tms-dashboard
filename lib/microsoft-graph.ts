// Microsoft Graph API client for OneDrive integration
import { ConfidentialClientApplication } from "@azure/msal-node"

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
  },
}

const cca = new ConfidentialClientApplication(msalConfig)

async function getAccessToken(): Promise<string> {
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
}

export interface OneDriveFolder {
  id: string
  name: string
  path: string
  files: OneDriveFile[]
  folders: OneDriveFolder[]
}

// List files in a specific folder
export async function listOneDriveFiles(
  folderId?: string,
  userId?: string
): Promise<{ files: OneDriveFile[]; folders: OneDriveFolder[] }> {
  const token = await getAccessToken()
  
  // Default to root if no folder specified
  const endpoint = userId
    ? folderId
      ? `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${folderId}/children`
      : `https://graph.microsoft.com/v1.0/users/${userId}/drive/root/children`
    : folderId
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`
      : `https://graph.microsoft.com/v1.0/me/drive/root/children`

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

  // First get file metadata
  const metaEndpoint = userId
    ? `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${fileId}`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`

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

// Search for PO files by name pattern
export async function searchOneDriveFiles(
  query: string,
  userId?: string
): Promise<OneDriveFile[]> {
  const token = await getAccessToken()

  const endpoint = userId
    ? `https://graph.microsoft.com/v1.0/users/${userId}/drive/root/search(q='${encodeURIComponent(query)}')`
    : `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')`

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
