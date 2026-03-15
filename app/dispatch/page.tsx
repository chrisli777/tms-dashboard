import { Truck } from "lucide-react"
import { SidebarLayout } from "@/components/sidebar-layout"
import { DispatchDashboard } from "@/components/dispatch/dispatch-dashboard"
import { fetchAllContainers } from "@/lib/dispatch-data"

// Force dynamic rendering to always get fresh data
export const dynamic = "force-dynamic"

export default async function DispatchPage() {
  const containers = await fetchAllContainers()

  return (
    <SidebarLayout
      title="Dispatcher"
      description="Track and manage container dispatch status"
      icon={<Truck className="h-8 w-8" />}
    >
      <DispatchDashboard initialData={containers} />
    </SidebarLayout>
  )
}
