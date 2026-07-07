/**
 * Simple username/password gate (NOT a real auth system).
 *
 * Credentials live in the APP_USERNAME / APP_PASSWORD environment variables.
 * On a successful login we store a session cookie whose value is a SHA-256
 * digest of the credentials. Middleware recomputes the expected digest and
 * compares, so the cookie can't be trivially forged without knowing the
 * credentials. This is intentionally lightweight and edge-compatible.
 */

export const SESSION_COOKIE = "tms_session"

/** Web Crypto SHA-256 → hex. Works in both the Edge runtime and Node. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

type Account = { username: string; password: string }

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
    accounts.push({ username: envUser, password: envPass })
  }

  // Shared visitor account.
  accounts.push({ username: "visitor", password: "whi0836" })

  return accounts
}

/** All valid session cookie tokens (one per allowed account). */
export async function getValidSessionTokens(): Promise<string[]> {
  const accounts = getAccounts()
  return Promise.all(accounts.map((a) => sha256Hex(`${a.username}:${a.password}`)))
}

/** Validate a submitted username/password against the allowed accounts. */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<string | null> {
  const match = getAccounts().find(
    (a) => a.username === username && a.password === password,
  )
  if (!match) return null
  return sha256Hex(`${match.username}:${match.password}`)
}
