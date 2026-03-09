"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, FileText, Ship, Truck, BarChart3, ChevronLeft } from "lucide-react"
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
    title: "Pipeline Dashboard",
    href: "/",
    icon: LayoutGrid,
  },
  {
    title: "Customer Forecast",
    href: "/forecast",
    icon: FileText,
  },
  {
    title: "Shipment Tracking",
    href: "/shipments",
    icon: Ship,
  },
  {
    title: "Dispatcher",
    href: "/dispatcher",
    icon: Truck,
  },
  {
    title: "Replenishment",
    href: "/replenishment",
    icon: BarChart3,
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
      <SidebarHeader className="h-14 flex-row items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 group-data-[collapsible=icon]:hidden"
        >
          <span className="text-base font-bold text-sidebar-accent-foreground">
            WHI SCM
          </span>
        </Link>
        <button
          onClick={toggleSidebar}
          className="flex size-6 items-center justify-center rounded text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <ChevronLeft
            className={`size-4 transition-transform ${
              state === "collapsed" ? "rotate-180" : ""
            }`}
          />
        </button>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.href)}
                tooltip={item.title}
                className="h-10 gap-3 rounded-lg px-3 text-sidebar-foreground transition-colors data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
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
