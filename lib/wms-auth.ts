// WMS Authentication helper for 3PL Central / Secure WMS API
// Uses OAuth2 client credentials flow

const WMS_CLIENT_ID = process.env.WMS_CLIENT_ID || "6fdb4625-017a-4bfc-b89e-908c48427e08"
const WMS_CLIENT_SECRET = process.env.WMS_CLIENT_SECRET || "51Osf4uoMZMJJhhp6tqzYN401mLXhGr4"
const WMS_TPL_GUID = process.env.WMS_TPL_GUID || "" // 3PL GUID if needed
const WMS_USER_LOGIN_ID = process.env.WMS_USER_LOGIN_ID || "" // User login ID if needed

// Token cache to avoid re-fetching
let cachedToken: string | null = null
let tokenExpiry: number = 0

export async function getWmsToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < tokenExpiry - 300000) {
    return cachedToken
  }

  // Build the Basic auth header from client credentials
  const basicAuth = Buffer.from(`${WMS_CLIENT_ID}:${WMS_CLIENT_SECRET}`).toString("base64")

  // 3PL Central OAuth token endpoint
  const tokenUrl = "https://secure-wms.com/AuthServer/api/Token"

  const body: Record<string, string> = {
    grant_type: "client_credentials",
  }

  // Add optional fields if provided
  if (WMS_TPL_GUID) {
    body.tpl = WMS_TPL_GUID
  }
  if (WMS_USER_LOGIN_ID) {
    body.user_login_id = WMS_USER_LOGIN_ID
  }

  console.log("[v0] Fetching WMS token...")

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("[v0] WMS token error:", response.status, errorText)
    throw new Error(`Failed to get WMS token: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  
  cachedToken = data.access_token
  // Set expiry based on expires_in (usually 3600 seconds)
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000
  
  console.log("[v0] WMS token obtained, expires in:", data.expires_in, "seconds")
  
  return cachedToken!
}
