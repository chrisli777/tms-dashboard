import { tool } from "ai"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Read-only logistics query tools for the AI assistant.
 *
 * These are exposed to Claude so it can look up live logistics data. They are
 * strictly read-only: only SELECT-style query-builder calls are used, the set
 * of queryable tables is allow-listed, and result sizes are capped. The
 * assistant can never mutate data through these tools.
 */

/** Logistics-relevant tables/views the assistant may read. */
export const LOGISTICS_TABLES = [
  "order_management_view",
  "shipments",
  "shipment_containers",
  "container_tracking",
  "shipment_tracking",
  "warehouse_receipts",
  "suppliers",
  "customers",
  "sku_master",
  "exceptions",
] as const

const tableEnum = z.enum(LOGISTICS_TABLES)

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 50

const filterSchema = z.object({
  column: z.string().describe("Column name to filter on."),
  operator: z
    .enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is_null", "not_null"])
    .describe(
      "Comparison operator. Use 'ilike' for case-insensitive text matching (wrap value in % for contains). Use 'in' with a comma-separated value. Use 'is_null'/'not_null' with no value.",
    ),
  value: z
    .string()
    .nullable()
    .describe("Comparison value. For 'in', comma-separated list. Leave null for is_null/not_null."),
})

type Filter = z.infer<typeof filterSchema>

// The Supabase query builder is heavily generic; we only need the chainable
// filter methods here, so a light structural type keeps this readable.
type FilterableQuery = {
  eq: (c: string, v: unknown) => FilterableQuery
  neq: (c: string, v: unknown) => FilterableQuery
  gt: (c: string, v: unknown) => FilterableQuery
  gte: (c: string, v: unknown) => FilterableQuery
  lt: (c: string, v: unknown) => FilterableQuery
  lte: (c: string, v: unknown) => FilterableQuery
  like: (c: string, v: string) => FilterableQuery
  ilike: (c: string, v: string) => FilterableQuery
  in: (c: string, v: unknown[]) => FilterableQuery
  is: (c: string, v: unknown) => FilterableQuery
  not: (c: string, op: string, v: unknown) => FilterableQuery
}

function applyFilters<T extends FilterableQuery>(query: T, filters: Filter[] | null | undefined): T {
  let q = query
  for (const f of filters ?? []) {
    const { column, operator, value } = f
    switch (operator) {
      case "eq":
        q = q.eq(column, value) as T
        break
      case "neq":
        q = q.neq(column, value) as T
        break
      case "gt":
        q = q.gt(column, value) as T
        break
      case "gte":
        q = q.gte(column, value) as T
        break
      case "lt":
        q = q.lt(column, value) as T
        break
      case "lte":
        q = q.lte(column, value) as T
        break
      case "like":
        q = q.like(column, value ?? "") as T
        break
      case "ilike":
        q = q.ilike(column, value ?? "") as T
        break
      case "in":
        q = q.in(
          column,
          (value ?? "").split(",").map((s) => s.trim()).filter(Boolean),
        ) as T
        break
      case "is_null":
        q = q.is(column, null) as T
        break
      case "not_null":
        q = q.not(column, "is", null) as T
        break
    }
  }
  return q
}

export const logisticsTools = {
  queryLogistics: tool({
    description:
      "Query live logistics data (containers, shipments, tracking, suppliers, customers, SKUs, exceptions). Returns matching rows. Use filters to narrow results and always prefer the 'order_management_view' for container/order questions since it joins shipment + container + tracking data.",
    inputSchema: z.object({
      table: tableEnum.describe("The table or view to read from."),
      columns: z
        .string()
        .nullable()
        .describe("Comma-separated columns to return, or null/'*' for all columns."),
      filters: z.array(filterSchema).nullable().describe("Optional filters, ANDed together."),
      orderBy: z.string().nullable().describe("Column to sort by, or null."),
      ascending: z.boolean().nullable().describe("Sort ascending? Defaults to false (descending)."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(MAX_LIMIT)
        .nullable()
        .describe(`Max rows to return (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}).`),
    }),
    execute: async ({ table, columns, filters, orderBy, ascending, limit }) => {
      const supabase = createAdminClient()
      let query = supabase.from(table).select(columns && columns.trim() ? columns : "*")
      query = applyFilters(query as unknown as FilterableQuery, filters) as unknown as typeof query
      if (orderBy) query = query.order(orderBy, { ascending: ascending ?? false })
      query = query.limit(Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT))

      const { data, error } = await query
      if (error) return { error: error.message }
      return { rowCount: data?.length ?? 0, rows: data ?? [] }
    },
  }),

  countLogistics: tool({
    description:
      "Count how many rows in a logistics table/view match the given filters. Use this for 'how many' questions (e.g. how many containers have arrived) instead of returning full rows.",
    inputSchema: z.object({
      table: tableEnum.describe("The table or view to count from."),
      filters: z.array(filterSchema).nullable().describe("Optional filters, ANDed together."),
    }),
    execute: async ({ table, filters }) => {
      const supabase = createAdminClient()
      let query = supabase.from(table).select("*", { count: "exact", head: true })
      query = applyFilters(query as unknown as FilterableQuery, filters) as unknown as typeof query
      const { count, error } = await query
      if (error) return { error: error.message }
      return { count: count ?? 0 }
    },
  }),
}
