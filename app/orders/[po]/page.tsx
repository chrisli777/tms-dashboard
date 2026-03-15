import { notFound } from "next/navigation"
import { FileText } from "lucide-react"
import { fetchOrderByPO } from "@/lib/order-data"
import { OrderDetail } from "@/components/orders/order-detail"
import { SidebarLayout } from "@/components/sidebar-layout"

// Force dynamic rendering to always get fresh data
export const dynamic = "force-dynamic"

interface OrderDetailPageProps {
  params: Promise<{ po: string }>
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { po } = await params
  const order = await fetchOrderByPO(decodeURIComponent(po))

  if (!order) {
    notFound()
  }

  return (
    <SidebarLayout
      title={`PO-${order.poNumber}`}
      description="Order details and associated shipments"
      icon={<FileText className="h-8 w-8" />}
      backHref="/"
    >
      <OrderDetail order={order} />
    </SidebarLayout>
  )
}
