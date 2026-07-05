import { notFound } from "next/navigation"
import { Package } from "lucide-react"
import { fetchContainerById } from "@/lib/dispatch-data"
import { ContainerDetail } from "@/components/dashboard/container-detail"
import { SidebarLayout } from "@/components/sidebar-layout"

// Force dynamic rendering to always get fresh data
export const dynamic = "force-dynamic"

interface ContainerPageProps {
  params: Promise<{ id: string }>
}

export default async function ContainerPage({ params }: ContainerPageProps) {
  const { id } = await params
  const container = await fetchContainerById(decodeURIComponent(id))

  if (!container) {
    notFound()
  }

  return (
    <SidebarLayout
      title={container.container}
      description={`${container.type} Container`}
      icon={<Package className="h-8 w-8" />}
      showBack
    >
      <ContainerDetail container={container} />
    </SidebarLayout>
  )
}
