import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE, verifyCredentials } from "@/lib/auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string }
    const username = body.username?.trim() ?? ""
    const password = body.password ?? ""

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    const result = await verifyCredentials(username, password)
    if (!result) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return NextResponse.json({ ok: true, role: result.role })
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
