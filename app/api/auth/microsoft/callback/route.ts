import { NextResponse } from "next/server"
import { exchangeCodeForTokens, setAuthCookies } from "@/lib/microsoft-auth"
import { cookies, headers } from "next/headers"

// Helper to get correct base URL - uses env var or detects from headers
async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  const headersList = await headers()
  const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000"
  const protocol = headersList.get("x-forwarded-proto") || "https"
  return `${protocol}://${host}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  const baseUrl = await getBaseUrl()

  // Handle errors from Microsoft
  if (error) {
    console.error("[v0] OAuth error:", error, errorDescription)
    return NextResponse.redirect(
      `${baseUrl}/orders?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/orders?error=Missing+code+or+state`)
  }

  // Validate state
  const cookieStore = await cookies()
  const savedState = cookieStore.get("ms_oauth_state")?.value

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${baseUrl}/orders?error=Invalid+state`)
  }

  // Clear state cookie
  cookieStore.delete("ms_oauth_state")

  // Parse state to get return URL
  let returnUrl = "/orders"
  try {
    const stateData = JSON.parse(Buffer.from(state, "base64").toString())
    returnUrl = stateData.returnUrl || "/orders"
  } catch {
    // Use default return URL
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/microsoft/callback`

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    // Store tokens in cookies
    await setAuthCookies(
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresIn
    )

    // Redirect back to the app with success
    return NextResponse.redirect(`${baseUrl}${returnUrl}?auth=success`)
  } catch (err) {
    console.error("[v0] Token exchange error:", err)
    return NextResponse.redirect(
      `${baseUrl}/orders?error=${encodeURIComponent("Failed to authenticate")}`
    )
  }
}
