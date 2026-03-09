"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

interface SidebarLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  icon?: React.ReactNode
}

export function SidebarLayout({
  children,
  title,
  description,
  icon,
}: SidebarLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="relative">
        {title && (
          <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-6 py-4">
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
          </header>
        )}
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
