// Business rules for the manually-managed Dispatcher assignment columns.
// Kept free of server-only imports so both server data code and client cells
// can share it.

/** Destination warehouses a container can be routed to. */
export const WAREHOUSE_OPTIONS = ["Kent", "Moses Lake"] as const
export type Warehouse = (typeof WAREHOUSE_OPTIONS)[number]

/** Trucking companies that arrange pickup. */
export const VENDOR_OPTIONS = [
  "Savanah Logistics",
  "Zip Trucklines",
  "Forward Air",
] as const
export type Vendor = (typeof VENDOR_OPTIONS)[number]

/**
 * HX SKUs 61415 and 824433 ship to Moses Lake; everything else defaults to
 * Kent. This is only a default — the warehouse is editable per container.
 */
export const MOSES_LAKE_SKUS = new Set(["61415", "824433"])

export function defaultWarehouseForSkus(skus: string[]): Warehouse {
  return skus.some((sku) => MOSES_LAKE_SKUS.has(sku.trim())) ? "Moses Lake" : "Kent"
}
