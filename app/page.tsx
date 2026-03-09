import { LayoutGrid } from "lucide-react"
import { OrderDashboard } from "@/components/orders/order-dashboard"
import { SidebarLayout } from "@/components/sidebar-layout"
import { fetchAllOrders } from "@/lib/order-data"

export default async function HomePage() {
  const orders = await fetchAllOrders()

  return (
    <SidebarLayout
      title="Pipeline Dashboard"
      description="Order & Inventory Management"
      icon={<LayoutGrid className="size-5" />}
    >
      <OrderDashboard initialData={orders} />
    </SidebarLayout>
  )
}
