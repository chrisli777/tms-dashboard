import { notFound } from "next/navigation"
import { Ship } from "lucide-react"
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
    <SidebarLayout
      title={summary.invoice}
      description={`BOL: ${summary.bol}`}
      icon={<Ship className="h-8 w-8" />}
      backHref="/shipments"
    >
      <BOLDetail summary={summary} />
    </SidebarLayout>
  )
}
