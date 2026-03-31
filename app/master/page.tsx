import { SidebarLayout } from "@/components/sidebar-layout"
import { MasterDashboard } from "@/components/master/master-dashboard"
import { FileSpreadsheet } from "lucide-react"

export const metadata = {
  title: "Master Table | TMS Dashboard",
  description: "Comprehensive supply chain analysis with 8 sheets",
}

export default function MasterPage() {
  return (
    <SidebarLayout
      title="Master Table"
      description="8-sheet analysis: Dashboard, Orders, Logistics, Tariff, Price, Profit, Containers, Config"
      icon={<FileSpreadsheet className="h-8 w-8" />}
    >
      <MasterDashboard />
    </SidebarLayout>
  )
}
