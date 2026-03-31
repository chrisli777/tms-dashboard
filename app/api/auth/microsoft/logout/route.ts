import { NextResponse } from "next/server"
import { clearAuthCookies } from "@/lib/microsoft-auth"

export async function POST() {
  await clearAuthCookies()
  return NextResponse.json({ success: true })
}

export async function GET(request: Request) {
  await clearAuthCookies()
  return NextResponse.redirect(new URL("/orders", request.url))
}
