-- Create master_orders table for storing synced PO data
CREATE TABLE IF NOT EXISTS master_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whi_po VARCHAR(100),
  supplier_invoice VARCHAR(100),
  supplier VARCHAR(100),
  customer VARCHAR(100),
  container_no VARCHAR(50),
  container_type VARCHAR(20),
  bl_no VARCHAR(100),
  vessel VARCHAR(200),
  sku VARCHAR(100),
  description TEXT,
  qty INTEGER DEFAULT 0,
  unit_price DECIMAL(12, 4) DEFAULT 0,
  amount DECIMAL(12, 2) DEFAULT 0,
  etd DATE,
  eta DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  CONSTRAINT unique_order_line UNIQUE (whi_po, supplier_invoice, container_no, sku)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_master_orders_whi_po ON master_orders(whi_po);
CREATE INDEX IF NOT EXISTS idx_master_orders_supplier ON master_orders(supplier);
CREATE INDEX IF NOT EXISTS idx_master_orders_container ON master_orders(container_no);
CREATE INDEX IF NOT EXISTS idx_master_orders_updated ON master_orders(updated_at DESC);

-- Enable RLS
ALTER TABLE master_orders ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow all for authenticated users" ON master_orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policy for service role
CREATE POLICY "Allow all for service role" ON master_orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
