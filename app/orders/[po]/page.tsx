import { notFound } from "next/navigation"
import { fetchOrderByPO } from "@/lib/order-data"
import { OrderDetail } from "@/components/orders/order-detail"
import { SidebarLayout } from "@/components/sidebar-layout"

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
    <SidebarLayout title={`Order ${order.poNumber}`} description="Order details and associated shipments">
      <OrderDetail order={order} />
    </SidebarLayout>
  )
}
