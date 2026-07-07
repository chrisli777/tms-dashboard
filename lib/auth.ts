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

/** The token value stored in the session cookie for the configured creds. */
export async function getExpectedSessionToken(): Promise<string | null> {
  const username = process.env.APP_USERNAME
  const password = process.env.APP_PASSWORD
  if (!username || !password) return null
  return sha256Hex(`${username}:${password}`)
}

/** Validate a submitted username/password against the configured credentials. */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<string | null> {
  const expectedUser = process.env.APP_USERNAME
  const expectedPass = process.env.APP_PASSWORD
  if (!expectedUser || !expectedPass) return null
  if (username !== expectedUser || password !== expectedPass) return null
  return sha256Hex(`${username}:${password}`)
}
