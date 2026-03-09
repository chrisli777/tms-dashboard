import { fetchAllBOLSummaries } from "@/lib/bol-data"
import { BOLDashboard } from "@/components/dashboard/bol-dashboard"

export default async function ShipmentsPage() {
  const summaries = await fetchAllBOLSummaries()
  return <BOLDashboard initialData={summaries} />
}
