"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, Ship, ChevronLeft, ChevronRight } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

const navItems = [
  {
    title: "Order Management",
    href: "/",
    icon: LayoutGrid,
  },
  {
    title: "Shipment Tracking",
    href: "/shipments",
    icon: Ship,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { toggleSidebar, state } = useSidebar()

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname.startsWith("/orders")
    }
    return pathname.startsWith(href)
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Header with title and toggle */}
      <SidebarHeader className="h-14 flex-row items-center px-3 gap-0">
        <Link
          href="/"
          className="flex items-center gap-2 group-data-[collapsible=icon]:hidden flex-1"
        >
          <span className="text-base font-bold tracking-tight text-sidebar-accent-foreground">
            WHI SCM
          </span>
        </Link>
        <button
          onClick={toggleSidebar}
          className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Toggle sidebar"
        >
          {state === "collapsed" ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </SidebarHeader>

      {/* Navigation menu */}
      <SidebarContent className="px-2 pt-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.href)}
                tooltip={item.title}
                className="h-11 gap-3 rounded-lg px-2.5 text-sidebar-foreground transition-colors data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              >
                <Link href={item.href}>
                  <item.icon className="size-5 shrink-0" />
                  <span className="text-sm">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}
