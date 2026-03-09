import { notFound } from "next/navigation"
import { FileText } from "lucide-react"
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
    <SidebarLayout
      title={`PO-${order.poNumber}`}
      description="Order details and associated shipments"
      icon={<FileText className="size-5" />}
    >
      <OrderDetail order={order} />
    </SidebarLayout>
  )
}
