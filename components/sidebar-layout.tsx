"use client"

import { ChevronRight } from "lucide-react"
import { SidebarProvider, SidebarInset, useSidebar } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

interface SidebarLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  icon?: React.ReactNode
}

function LayoutContent({
  children,
  title,
  description,
  icon,
}: SidebarLayoutProps) {
  const { toggleSidebar, state } = useSidebar()

  return (
    <SidebarInset className="relative">
      {/* Floating toggle button on the left edge */}
      <button
        onClick={toggleSidebar}
        className="absolute left-0 top-4 z-10 flex size-6 items-center justify-center rounded-r-md bg-sidebar text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <ChevronRight
          className={`size-4 transition-transform ${
            state === "expanded" ? "rotate-180" : ""
          }`}
        />
      </button>

      {title && (
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background pl-10 pr-6">
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
  )
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
      <LayoutContent title={title} description={description} icon={icon}>
        {children}
      </LayoutContent>
    </SidebarProvider>
  )
}
