import { notFound } from "next/navigation"
import { Package } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ContainerDetail } from "@/components/dashboard/container-detail"
import { SidebarLayout } from "@/components/sidebar-layout"

interface ContainerPageProps {
  params: Promise<{ id: string }>
}

async function fetchContainerById(id: string) {
  const supabase = await createClient()

  const { data: container, error } = await supabase
    .from("containers")
    .select(`
      id,
      container,
      type,
      status,
      shipment_id,
      shipments (
        id,
        invoice,
        bol,
        supplier,
        customer,
        etd,
        eta,
        status
      ),
      container_items (
        id,
        sku,
        qty,
        gw_kg,
        unit_price_usd,
        amount_usd,
        whi_po
      )
    `)
    .eq("id", id)
    .single()

  if (error || !container) {
    return null
  }

  return container
}

export default async function ContainerPage({ params }: ContainerPageProps) {
  const { id } = await params
  const container = await fetchContainerById(id)

  if (!container) {
    notFound()
  }

  const shipment = container.shipments as {
    id: string
    invoice: string
    bol: string
    supplier: string
    customer: string
    etd: string
    eta: string
    status: string
  }

  return (
    <SidebarLayout
      title={container.container}
      description={`${container.type} Container`}
      icon={<Package className="h-8 w-8" />}
      backHref={`/bol/${encodeURIComponent(shipment.bol)}`}
    >
      <ContainerDetail container={container} shipment={shipment} />
    </SidebarLayout>
  )
}
