import { NextResponse, type NextRequest } from "next/server"
import {
  SESSION_COOKIE,
  getRoleForToken,
  isPathAllowedForVisitor,
  VISITOR_HOME,
} from "@/lib/auth"

/**
 * Login gate + role-based access control.
 *
 * - Any request without a valid session cookie is redirected to /login
 *   (except the login page itself and the auth API).
 * - Already-logged-in users hitting /login are sent to their home page.
 * - The `visitor` role is read-only: it may only view the Shipment Tracking and
 *   Dispatcher areas, and may not perform any mutating API request.
 *
 * The matcher below already excludes Next internals and static assets, so we
 * only special-case the login route and auth endpoints here.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAuthApi = pathname.startsWith("/api/auth/")
  const isLoginPage = pathname === "/login"

  // Never gate the auth endpoints themselves.
  if (isAuthApi) return NextResponse.next()

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const role = await getRoleForToken(token)
  const isAuthed = role !== null

  if (isLoginPage) {
    if (isAuthed) {
      const home = role === "visitor" ? VISITOR_HOME : "/"
      return NextResponse.redirect(new URL(home, request.url))
    }
    return NextResponse.next()
  }

  if (!isAuthed) {
    const loginUrl = new URL("/login", request.url)
    // Preserve where the user was headed so we can bounce back after login.
    if (pathname && pathname !== "/") {
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search)
    }
    return NextResponse.redirect(loginUrl)
  }

  // Role-based restrictions for the read-only visitor account.
  if (role === "visitor") {
    const isApi = pathname.startsWith("/api/")

    if (isApi) {
      // The AI assistant is read-only (it only queries data), so allow it even
      // though it uses POST.
      if (pathname === "/api/chat") return NextResponse.next()

      // Otherwise visitors may read (GET/HEAD) but never mutate.
      const method = request.method.toUpperCase()
      if (method !== "GET" && method !== "HEAD") {
        return NextResponse.json({ error: "Read-only access" }, { status: 403 })
      }
      return NextResponse.next()
    }

    // Restrict page navigation to the allowed areas.
    if (!isPathAllowedForVisitor(pathname)) {
      return NextResponse.redirect(new URL(VISITOR_HOME, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except Next internals, the favicon, and static asset
  // files (identified by a file extension). This keeps /api/* gated too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
}
