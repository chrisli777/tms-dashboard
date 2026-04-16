# TMS Database Schema

Generated: 2026-04-06

## Tables Overview

| Table | Description |
|-------|-------------|
| config_customer_quotations | 客户报价配置 |
| config_sku_tariffs | SKU关税配置 |
| config_supplier_quotations | 供应商报价配置 |
| container_items | 集装箱明细 |
| containers | 集装箱 |
| cvas_logistics_costs | 物流成本 |
| logistics_cost_allocations | 物流成本分摊 |
| master_dashboard_metrics | 仪表盘指标 |
| master_orders | 主订单表 |
| orders | 采购订单 |
| pending_items | 待处理项目 |
| price_verifications | 价格核验 |
| profit_analysis | 利润分析 |
| shipments | 发货单/提单 |
| tariff_allocations | 关税分摊 |

---

## 1. config_customer_quotations (客户报价配置)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| customer | text | NO | - |
| sku | text | NO | - |
| quoted_price | numeric | NO | 0 |
| effective_date | date | NO | CURRENT_DATE |
| notes | text | YES | - |
| updated_at | timestamptz | NO | now() |

---

## 2. config_sku_tariffs (SKU关税配置)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| sku | text | NO | - |
| hts_code | text | YES | - |
| theoretical_rate | numeric | NO | 0 |
| actual_rate | numeric | NO | 0 |
| description | text | YES | - |
| updated_at | timestamptz | NO | now() |

---

## 3. config_supplier_quotations (供应商报价配置)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| supplier | text | NO | - |
| sku | text | NO | - |
| quoted_price | numeric | NO | 0 |
| effective_date | date | NO | CURRENT_DATE |
| notes | text | YES | - |
| updated_at | timestamptz | NO | now() |

---

## 4. container_items (集装箱明细)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| container_id | uuid | NO | - |
| sku | text | NO | - |
| qty | integer | NO | - |
| gw_kg | numeric | NO | - |
| unit_price_usd | numeric | NO | - |
| amount_usd | numeric | NO | - |
| whi_po | text | NO | - |
| created_at | timestamptz | NO | now() |
| order_id | uuid | YES | - |
| description | text | YES | - |
| unit_price | numeric | YES | - |
| eta | date | YES | - |
| supplier | text | YES | - |
| customer | text | YES | - |

---

## 5. containers (集装箱)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| shipment_id | uuid | NO | - |
| container | text | NO | - |
| type | text | NO | - |
| status | text | NO | 'In Transit' |
| created_at | timestamptz | NO | now() |

---

## 6. cvas_logistics_costs (物流成本)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| shipment_id | uuid | YES | - |
| bol | text | YES | - |
| sea_freight | numeric | NO | 0 |
| customs_fee | numeric | NO | 0 |
| domestic_freight | numeric | NO | 0 |
| other_fees | numeric | NO | 0 |
| total_cost | numeric | NO | 0 |
| invoice_number | text | YES | - |
| invoice_date | date | YES | - |
| created_at | timestamptz | NO | now() |

---

## 7. logistics_cost_allocations (物流成本分摊)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| shipment_id | uuid | YES | - |
| sku | text | NO | - |
| quantity | integer | NO | 0 |
| weight_kg | numeric | NO | 0 |
| weight_share | numeric | NO | 0 |
| sea_freight | numeric | NO | 0 |
| customs_fee | numeric | NO | 0 |
| domestic_freight | numeric | NO | 0 |
| total_freight | numeric | NO | 0 |
| unit_freight | numeric | NO | 0 |
| created_at | timestamptz | NO | now() |

---

## 8. master_dashboard_metrics (仪表盘指标)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| snapshot_date | date | NO | CURRENT_DATE |
| total_shipments | integer | NO | 0 |
| total_containers | integer | NO | 0 |
| total_value | numeric | NO | 0 |
| cleared_shipments | integer | NO | 0 |
| in_transit_shipments | integer | NO | 0 |
| theoretical_tariff | numeric | NO | 0 |
| actual_tariff | numeric | NO | 0 |
| tariff_savings | numeric | NO | 0 |
| tariff_savings_rate | numeric | NO | 0 |
| created_at | timestamptz | NO | now() |

---

## 9. master_orders (主订单表)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| whi_po | varchar | YES | - |
| supplier_invoice | varchar | YES | - |
| supplier | varchar | YES | - |
| customer | varchar | YES | - |
| container_no | varchar | YES | - |
| container_type | varchar | YES | - |
| bl_no | varchar | YES | - |
| vessel | varchar | YES | - |
| sku | varchar | YES | - |
| description | text | YES | - |
| qty | integer | YES | 0 |
| unit_price | numeric | YES | 0 |
| amount | numeric | YES | 0 |
| etd | date | YES | - |
| eta | date | YES | - |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

## 10. orders (采购订单)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| po_number | text | NO | - |
| supplier | text | NO | - |
| customer | text | NO | - |
| order_date | date | NO | - |
| status | text | NO | 'Open' |
| notes | text | YES | - |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| due_date | date | YES | - |

---

## 11. pending_items (待处理项目)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| order_id | uuid | NO | - |
| sku | text | NO | - |
| description | text | YES | - |
| qty_ordered | integer | NO | 0 |
| qty_received | integer | NO | 0 |
| unit_cost | numeric | NO | 0 |
| amount | numeric | NO | 0 |
| weight | numeric | NO | 0 |
| created_at | timestamptz | NO | now() |

---

## 12. price_verifications (价格核验)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| shipment_id | uuid | YES | - |
| sku | text | NO | - |
| quantity | integer | NO | 0 |
| supplier_invoice_price | numeric | NO | 0 |
| supplier_quoted_price | numeric | NO | 0 |
| supplier_variance | numeric | NO | 0 |
| customer_total_price | numeric | NO | 0 |
| margin_per_unit | numeric | NO | 0 |
| has_alert | boolean | NO | false |
| alert_message | text | YES | - |
| created_at | timestamptz | NO | now() |

---

## 13. profit_analysis (利润分析)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| shipment_id | uuid | YES | - |
| sku | text | NO | - |
| quantity | integer | NO | 0 |
| customer_quote_unit | numeric | NO | 0 |
| exw_cost | numeric | NO | 0 |
| freight_cost | numeric | NO | 0 |
| tariff_cost | numeric | NO | 0 |
| total_cost_unit | numeric | NO | 0 |
| gross_profit_unit | numeric | NO | 0 |
| margin_percent | numeric | NO | 0 |
| is_provisional | boolean | NO | true |
| status | text | NO | 'Normal' |
| created_at | timestamptz | NO | now() |

---

## 14. shipments (发货单/提单)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| invoice | text | NO | - |
| bol | text | YES | - |
| supplier | text | NO | - |
| customer | text | NO | - |
| etd | date | NO | - |
| eta | date | NO | - |
| status | text | NO | 'In Transit' |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| container_count | integer | YES | 0 |
| sku_count | integer | YES | 0 |
| total_value | numeric | YES | 0 |
| total_weight | numeric | YES | 0 |
| po_numbers | ARRAY | YES | - |
| incoterm | text | YES | - |
| currency | text | YES | 'USD' |
| folder_name | text | YES | - |

---

## 15. tariff_allocations (关税分摊)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| shipment_id | uuid | YES | - |
| sku | text | NO | - |
| quantity | integer | NO | 0 |
| hts_code | text | YES | - |
| theoretical_rate | numeric | NO | 0 |
| actual_rate | numeric | NO | 0 |
| exw_value | numeric | NO | 0 |
| theoretical_tariff | numeric | NO | 0 |
| actual_tariff | numeric | NO | 0 |
| unit_tariff | numeric | NO | 0 |
| savings | numeric | NO | 0 |
| created_at | timestamptz | NO | now() |

---

## Entity Relationships

```
orders (1) ─────────────── (N) pending_items
   │
   └── order_id

orders (1) ─────────────── (N) container_items
   │
   └── order_id

shipments (1) ───────────── (N) containers
   │
   └── shipment_id

containers (1) ─────────── (N) container_items
   │
   └── container_id

shipments (1) ───────────── (N) cvas_logistics_costs
   │
   └── shipment_id

shipments (1) ───────────── (N) logistics_cost_allocations
   │
   └── shipment_id

shipments (1) ───────────── (N) tariff_allocations
   │
   └── shipment_id

shipments (1) ───────────── (N) price_verifications
   │
   └── shipment_id

shipments (1) ───────────── (N) profit_analysis
   │
   └── shipment_id
```
