import { Warehouse } from "lucide-react"
import { SidebarLayout } from "@/components/sidebar-layout"
import { WarehouseReceivingDashboard } from "@/components/warehouse/warehouse-receiving-dashboard"

export const dynamic = "force-dynamic"

export default function WarehouseReceivingPage() {
  return (
    <SidebarLayout
      title="Warehouse Receiving"
      description="View and export warehouse receiving records"
      icon={<Warehouse className="h-8 w-8" />}
    >
      <WarehouseReceivingDashboard />
    </SidebarLayout>
  )
}
