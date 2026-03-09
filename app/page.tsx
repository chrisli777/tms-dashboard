import { OrderDashboard } from "@/components/orders/order-dashboard"
import { SidebarLayout } from "@/components/sidebar-layout"
import { fetchAllOrders } from "@/lib/order-data"

export default async function HomePage() {
  const orders = await fetchAllOrders()

  return (
    <SidebarLayout title="Order Management" description="Track purchase orders from placement to delivery">
      <OrderDashboard initialData={orders} />
    </SidebarLayout>
  )
}
