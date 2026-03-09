import { notFound } from "next/navigation"
import { fetchOrderByPO } from "@/lib/order-data"
import { OrderDetail } from "@/components/orders/order-detail"

interface OrderDetailPageProps {
  params: Promise<{ po: string }>
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { po } = await params
  const order = await fetchOrderByPO(decodeURIComponent(po))

  if (!order) {
    notFound()
  }

  return <OrderDetail order={order} />
}
