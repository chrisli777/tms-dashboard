/**
 * Simple username/password gate (NOT a real auth system).
 *
 * The primary admin account comes from the APP_USERNAME / APP_PASSWORD
 * environment variables; additional accounts (e.g. a read-only visitor) are
 * defined here. On a successful login we store a session cookie whose value is
 * a SHA-256 digest of the credentials. Middleware recomputes the expected
 * digests and compares, so the cookie can't be trivially forged without knowing
 * a valid set of credentials. This is intentionally lightweight and
 * edge-compatible (no next/headers imports here).
 */

export const SESSION_COOKIE = "tms_session"

/** Access roles. `admin` can edit everything; `visitor` is read-only. */
export type Role = "admin" | "visitor"

/** Web Crypto SHA-256 → hex. Works in both the Edge runtime and Node. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

type Account = { username: string; password: string; role: Role }

/**
 * The list of accounts allowed to sign in. The primary admin account comes
 * from the APP_USERNAME / APP_PASSWORD environment variables; additional
 * accounts (e.g. a read-only visitor) are defined here.
 */
function getAccounts(): Account[] {
  const accounts: Account[] = []

  const envUser = process.env.APP_USERNAME
  const envPass = process.env.APP_PASSWORD
  if (envUser && envPass) {
    accounts.push({ username: envUser, password: envPass, role: "admin" })
  }

  // Read-only visitor account.
  accounts.push({ username: "visitor", password: "whi0836", role: "visitor" })

  return accounts
}

async function tokenForAccount(a: Account): Promise<string> {
  return sha256Hex(`${a.username}:${a.password}`)
}

/** All valid session cookie tokens (one per allowed account). */
export async function getValidSessionTokens(): Promise<string[]> {
  const accounts = getAccounts()
  return Promise.all(accounts.map((a) => tokenForAccount(a)))
}

/** Resolve the role associated with a session token, or null if invalid. */
export async function getRoleForToken(token: string | undefined | null): Promise<Role | null> {
  if (!token) return null
  const accounts = getAccounts()
  const tokens = await Promise.all(accounts.map((a) => tokenForAccount(a)))
  const idx = tokens.findIndex((t) => t === token)
  return idx === -1 ? null : accounts[idx].role
}

/** Validate a submitted username/password against the allowed accounts. */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<{ token: string; role: Role } | null> {
  const match = getAccounts().find(
    (a) => a.username === username && a.password === password,
  )
  if (!match) return null
  return { token: await tokenForAccount(match), role: match.role }
}

/**
 * Page path prefixes a visitor is allowed to view. Everything else (Order
 * Management, Master Table, Warehouse Receiving, …) is off-limits and gets
 * redirected to the Shipment Tracking dashboard.
 */
export const VISITOR_ALLOWED_PREFIXES = ["/shipments", "/bol", "/dispatch", "/container"] as const

/** Where a visitor lands / is bounced to when they hit a disallowed page. */
export const VISITOR_HOME = "/shipments"

/** True if the given app path is viewable by a visitor. */
export function isPathAllowedForVisitor(pathname: string): boolean {
  if (pathname === "/login") return true
  return VISITOR_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  )
}
