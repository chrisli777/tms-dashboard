import { notFound } from "next/navigation"
import { fetchBOLByBol } from "@/lib/bol-data"
import { BOLDetail } from "@/components/dashboard/bol-detail"
import { SidebarLayout } from "@/components/sidebar-layout"

interface BOLPageProps {
  params: Promise<{ id: string }>
}

export default async function BOLPage({ params }: BOLPageProps) {
  const { id } = await params
  const decodedId = decodeURIComponent(id)
  const summary = await fetchBOLByBol(decodedId)

  if (!summary) {
    notFound()
  }

  return (
    <SidebarLayout title={`BOL ${summary.bol}`} description="Shipment details and container breakdown">
      <BOLDetail summary={summary} />
    </SidebarLayout>
  )
}
