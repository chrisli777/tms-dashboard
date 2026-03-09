import { fetchAllBOLSummaries } from "@/lib/bol-data"
import { BOLDashboard } from "@/components/dashboard/bol-dashboard"
import { SidebarLayout } from "@/components/sidebar-layout"

export default async function ShipmentsPage() {
  const summaries = await fetchAllBOLSummaries()

  return (
    <SidebarLayout title="Shipment Tracking" description="Track shipments from origin to warehouse delivery">
      <BOLDashboard initialData={summaries} />
    </SidebarLayout>
  )
}
