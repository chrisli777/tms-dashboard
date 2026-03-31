"use client"

import { useEffect, useState } from "react"
import { Cloud, CloudOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AuthStatus {
  authenticated: boolean
  user?: { name: string; email: string }
}

export function OneDriveStatus() {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/auth/microsoft/status")
      const data = await response.json()
      setStatus(data)
    } catch {
      setStatus({ authenticated: false })
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = () => {
    window.location.href = `/api/auth/microsoft/login?returnUrl=${encodeURIComponent(window.location.pathname)}`
  }

  const handleSignOut = async () => {
    await fetch("/api/auth/microsoft/logout", { method: "POST" })
    setStatus({ authenticated: false })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    )
  }

  if (!status?.authenticated) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignIn}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <CloudOff className="size-4" />
              <span className="hidden sm:inline">Connect OneDrive</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Sign in to sync with OneDrive</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="gap-2 text-green-600 hover:text-green-700"
          >
            <Cloud className="size-4" />
            <span className="hidden sm:inline">{status.user?.email || "Connected"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Connected as {status.user?.email}</p>
          <p className="text-xs text-muted-foreground">Click to sign out</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
