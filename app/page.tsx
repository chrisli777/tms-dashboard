import { OrderDashboard } from "@/components/orders/order-dashboard"
import { fetchAllOrders } from "@/lib/order-data"

export default async function HomePage() {
  const orders = await fetchAllOrders()
  return <OrderDashboard initialData={orders} />
}
