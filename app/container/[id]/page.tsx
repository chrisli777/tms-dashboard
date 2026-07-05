import { notFound } from "next/navigation"
import { Package } from "lucide-react"
import { fetchContainerById } from "@/lib/dispatch-data"
import { ContainerDetail } from "@/components/dashboard/container-detail"
import { SidebarLayout } from "@/components/sidebar-layout"

// Force dynamic rendering to always get fresh data
export const dynamic = "force-dynamic"

interface ContainerPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function ContainerPage({ params, searchParams }: ContainerPageProps) {
  const { id } = await params
  const { from } = await searchParams
  const container = await fetchContainerById(decodeURIComponent(id))

  if (!container) {
    notFound()
  }

  // The back arrow returns to wherever the user came from (Dispatcher, BOL, …).
  // We only accept in-app absolute paths and fall back to the container's BOL.
  const backHref =
    from && from.startsWith("/") ? from : `/bol/${encodeURIComponent(container.bol)}`

  return (
    <SidebarLayout
      title={container.container}
      description="Container"
      icon={<Package className="h-8 w-8" />}
      backHref={backHref}
    >
      <ContainerDetail container={container} />
    </SidebarLayout>
  )
}
