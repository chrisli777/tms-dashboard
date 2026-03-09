import { LayoutGrid } from "lucide-react"
import { OrderDashboard } from "@/components/orders/order-dashboard"
import { SidebarLayout } from "@/components/sidebar-layout"
import { fetchAllOrders } from "@/lib/order-data"

// Force dynamic rendering to always get fresh data
export const dynamic = "force-dynamic"

export default async function HomePage() {
  const orders = await fetchAllOrders()

  return (
    <SidebarLayout
      title="Order Management"
      description="Track and manage purchase orders"
      icon={<LayoutGrid className="h-8 w-8" />}
    >
      <OrderDashboard initialData={orders} />
    </SidebarLayout>
  )
}
