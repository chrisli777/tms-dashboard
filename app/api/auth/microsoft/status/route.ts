import { NextResponse } from "next/server"
import { isAuthenticated, getValidAccessToken } from "@/lib/microsoft-auth"

export async function GET() {
  const authenticated = await isAuthenticated()
  
  if (!authenticated) {
    return NextResponse.json({ authenticated: false })
  }

  // Get user info if authenticated
  try {
    const token = await getValidAccessToken()
    if (!token) {
      return NextResponse.json({ authenticated: false })
    }

    // Get user profile from Microsoft Graph
    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json({ authenticated: true })
    }

    const user = await response.json()

    return NextResponse.json({
      authenticated: true,
      user: {
        name: user.displayName,
        email: user.mail || user.userPrincipalName,
      },
    })
  } catch {
    return NextResponse.json({ authenticated: true })
  }
}
