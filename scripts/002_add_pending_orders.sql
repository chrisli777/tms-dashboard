-- Add due_date column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS due_date DATE;

-- Create pending_items table to track SKUs for pending POs
CREATE TABLE IF NOT EXISTS public.pending_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  description TEXT,
  qty_ordered INTEGER NOT NULL DEFAULT 0,
  qty_received INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  weight NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
