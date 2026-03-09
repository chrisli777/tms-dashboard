import { Ship } from "lucide-react"
import { fetchAllBOLSummaries } from "@/lib/bol-data"
import { BOLDashboard } from "@/components/dashboard/bol-dashboard"
import { SidebarLayout } from "@/components/sidebar-layout"

// Force dynamic rendering to always get fresh data
export const dynamic = "force-dynamic"

export default async function ShipmentsPage() {
  const summaries = await fetchAllBOLSummaries()

  return (
    <SidebarLayout
      title="Shipment Tracking"
      description="Track shipments from origin to warehouse delivery"
      icon={<Ship className="h-8 w-8" />}
    >
      <BOLDashboard initialData={summaries} />
    </SidebarLayout>
  )
}
