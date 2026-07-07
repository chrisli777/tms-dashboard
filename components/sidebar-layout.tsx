"use client"

import { useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { OneDriveStatus } from "@/components/onedrive-status"
import { ChatWidget } from "@/components/chatbot/chat-widget"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useCanEdit } from "@/components/providers/role-provider"

interface SidebarLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  icon?: React.ReactNode
  /** Navigate to a fixed route when the back arrow is clicked. */
  backHref?: string
  /** Show the back arrow but return to the previous page via browser history. */
  showBack?: boolean
}

export function SidebarLayout({
  children,
  title,
  description,
  icon,
  backHref,
  showBack,
}: SidebarLayoutProps) {
  const router = useRouter()
  const canEdit = useCanEdit()

  const showBackButton = backHref !== undefined || showBack

  const handleBack = () => {
    if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="relative">
        {title && (
          <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-6 py-4">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="mr-1 size-8 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            {icon && (
              <div className="flex size-8 items-center justify-center text-primary">
                {icon}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-2xl font-bold leading-tight text-primary">
                {title}
              </span>
              {description && (
                <span className="text-sm text-muted-foreground">{description}</span>
              )}
            </div>
            {/* OneDrive status in top right (editors only) */}
            {canEdit && (
              <div className="ml-auto">
                <OneDriveStatus />
              </div>
            )}
          </header>
        )}
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
      <ChatWidget />
    </SidebarProvider>
  )
}
