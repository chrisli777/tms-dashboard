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
          <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-8">
            {icon && (
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {icon}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xl font-semibold leading-tight text-primary">
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
