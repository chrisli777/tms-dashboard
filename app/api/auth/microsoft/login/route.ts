import { NextResponse } from "next/server"
import { getAuthorizationUrl, clearAuthCookies } from "@/lib/microsoft-auth"
import { cookies, headers } from "next/headers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const returnUrl = searchParams.get("returnUrl") || "/orders"
  
  // Clear any existing tokens before new login
  await clearAuthCookies()
  
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

  // Get the correct public URL using headers (handles serverless/proxy environments)
  const headersList = await headers()
  const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000"
  const protocol = headersList.get("x-forwarded-proto") || "https"
  const baseUrl = `${protocol}://${host}`
  const redirectUri = `${baseUrl}/api/auth/microsoft/callback`
  
  console.log("[v0] OAuth redirect URI:", redirectUri)

  const authUrl = getAuthorizationUrl(redirectUri, state)

  return NextResponse.redirect(authUrl)
}
