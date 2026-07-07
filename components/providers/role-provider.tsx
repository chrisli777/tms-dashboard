"use client"

import { createContext, useContext } from "react"
import type { Role } from "@/lib/auth"

const RoleContext = createContext<Role | null>(null)

/**
 * Provides the current user's role to client components. The role is resolved
 * on the server (from the session cookie) and passed in, so there is no
 * hydration flash.
 */
export function RoleProvider({
  role,
  children,
}: {
  role: Role | null
  children: React.ReactNode
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

/** The current role, or null when signed out. */
export function useRole(): Role | null {
  return useContext(RoleContext)
}

/**
 * Whether the current user may edit. Everyone except the read-only `visitor`
 * role can edit. Signed-out (null) defaults to false.
 */
export function useCanEdit(): boolean {
  const role = useContext(RoleContext)
  return role === "admin"
}
