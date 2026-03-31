import { NextResponse } from "next/server"
import { exchangeCodeForTokens, setAuthCookies } from "@/lib/microsoft-auth"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  // Handle errors from Microsoft
  if (error) {
    console.error("[v0] OAuth error:", error, errorDescription)
    return NextResponse.redirect(
      new URL(`/orders?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/orders?error=Missing+code+or+state", request.url)
    )
  }

  // Validate state
  const cookieStore = await cookies()
  const savedState = cookieStore.get("ms_oauth_state")?.value

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      new URL("/orders?error=Invalid+state", request.url)
    )
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
    // Get the base URL for redirect
    const baseUrl = new URL(request.url).origin
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
    return NextResponse.redirect(new URL(`${returnUrl}?auth=success`, request.url))
  } catch (err) {
    console.error("[v0] Token exchange error:", err)
    return NextResponse.redirect(
      new URL(`/orders?error=${encodeURIComponent("Failed to authenticate")}`, request.url)
    )
  }
}
