import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, getExpectedSessionToken } from "@/lib/auth"

/**
 * Simple login gate. Any request without a valid session cookie is redirected
 * to /login (except the login page itself and the auth API). Already-logged-in
 * users hitting /login are sent to the home page.
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

  const expected = await getExpectedSessionToken()
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const isAuthed = expected !== null && token === expected

  if (isLoginPage) {
    if (isAuthed) {
      return NextResponse.redirect(new URL("/", request.url))
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

  return NextResponse.next()
}

export const config = {
  // Run on everything except Next internals, the favicon, and static asset
  // files (identified by a file extension). This keeps /api/* gated too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
}
