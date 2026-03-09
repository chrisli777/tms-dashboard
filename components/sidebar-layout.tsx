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
          <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-6">
            {icon && (
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {icon}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-lg font-semibold leading-tight text-foreground">
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
