// Microsoft OAuth Authentication for Delegated Access
// This enables access to "Shared with me" files

import { cookies } from "next/headers"

const TENANT_ID = "3ca75e96-5bb7-49da-8836-e47210951589"
const CLIENT_ID = "533c767d-c6f2-4eff-8086-c4afcb6447e8"
const CLIENT_SECRET = "gzh8Q~GMus~t5iJdO1UVxvPsJOXThl66yE0lscv~"

// Scopes needed for OneDrive access (admin consent already granted)
const SCOPES = [
  "openid",
  "profile", 
  "email",
  "offline_access",
  "Files.Read.All",  // Read all files user can access (including shared)
  "User.Read",       // Read user profile
].join(" ")

export function getAuthorizationUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES,
    state: state,
    // Use "login" since admin consent is already granted
    prompt: "login",
  })

  return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params}`
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  idToken?: string
}> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: SCOPES,
  })

  const response = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error("[v0] Token exchange error:", error)
    throw new Error(`Failed to exchange code for tokens: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    idToken: data.id_token,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES,
  })

  const response = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh token: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
  }
}

// Cookie names
const ACCESS_TOKEN_COOKIE = "ms_access_token"
const REFRESH_TOKEN_COOKIE = "ms_refresh_token"
const TOKEN_EXPIRY_COOKIE = "ms_token_expiry"

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  expiresIn: number
) {
  const cookieStore = await cookies()
  const expiryTime = Date.now() + expiresIn * 1000

  // Access token - shorter lived
  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: expiresIn,
    path: "/",
  })

  // Refresh token - longer lived (14 days)
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
  })

  // Token expiry time
  cookieStore.set(TOKEN_EXPIRY_COOKIE, expiryTime.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
  })
}

export async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = await cookies()
  
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value
  const tokenExpiry = cookieStore.get(TOKEN_EXPIRY_COOKIE)?.value

  if (!accessToken || !refreshToken) {
    return null
  }

  // Check if token is expired (with 5 minute buffer)
  const expiryTime = parseInt(tokenExpiry || "0", 10)
  const isExpired = Date.now() > expiryTime - 5 * 60 * 1000

  if (!isExpired) {
    return accessToken
  }

  // Token expired, try to refresh
  try {
    const newTokens = await refreshAccessToken(refreshToken)
    await setAuthCookies(
      newTokens.accessToken,
      newTokens.refreshToken,
      newTokens.expiresIn
    )
    return newTokens.accessToken
  } catch {
    // Refresh failed, user needs to re-authenticate
    return null
  }
}

export async function clearAuthCookies() {
  const cookieStore = await cookies()
  cookieStore.delete(ACCESS_TOKEN_COOKIE)
  cookieStore.delete(REFRESH_TOKEN_COOKIE)
  cookieStore.delete(TOKEN_EXPIRY_COOKIE)
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getValidAccessToken()
  return token !== null
}
