"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutGrid,
  Ship,
  Truck,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Warehouse,
  LogOut,
} from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
  {
    title: "Dispatcher",
    href: "/dispatch",
    icon: Truck,
  },
  {
    title: "Warehouse Receiving",
    href: "/warehouse-receiving",
    icon: Warehouse,
  },
  {
    title: "Master Table",
    href: "/master",
    icon: FileSpreadsheet,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { toggleSidebar, state } = useSidebar()

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/login")
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname.startsWith("/orders")
    }
    if (href === "/shipments") {
      return pathname.startsWith("/shipments") || pathname.startsWith("/bol")
    }
    return pathname.startsWith(href)
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Header with title and toggle */}
      <SidebarHeader className="h-14 flex-row items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center group-data-[collapsible=icon]:hidden"
        >
          <span className="text-lg font-bold text-white">
            WHI SCM
          </span>
        </Link>
        <button
          onClick={toggleSidebar}
          className="flex size-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Toggle sidebar"
        >
          {state === "collapsed" ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
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
                className="h-10 gap-3 rounded-md px-3 text-sm font-medium text-slate-300 transition-colors data-[active=true]:bg-slate-700 data-[active=true]:text-white hover:bg-slate-800 hover:text-white"
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      {/* Logout */}
      <SidebarFooter className="px-2 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={handleLogout}
              className="h-10 gap-3 rounded-md px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
