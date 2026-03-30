import { NextResponse } from "next/server"
import { getAuthorizationUrl } from "@/lib/microsoft-auth"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const returnUrl = searchParams.get("returnUrl") || "/orders"
  
  // Generate a random state for CSRF protection
  const state = Buffer.from(
    JSON.stringify({
      returnUrl,
      nonce: Math.random().toString(36).substring(7),
    })
  ).toString("base64")

  // Store state in cookie for validation
  const cookieStore = await cookies()
  cookieStore.set("ms_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  })

  // Get the base URL for redirect
  const baseUrl = new URL(request.url).origin
  const redirectUri = `${baseUrl}/api/auth/microsoft/callback`

  const authUrl = getAuthorizationUrl(redirectUri, state)

  return NextResponse.redirect(authUrl)
}
