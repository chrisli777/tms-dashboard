CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice TEXT NOT NULL,
  bol TEXT NOT NULL UNIQUE,
  supplier TEXT NOT NULL,
  customer TEXT NOT NULL,
  etd DATE NOT NULL,
  eta DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'In Transit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  container TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'In Transit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.container_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES public.containers(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  whi_po TEXT NOT NULL,
  qty INTEGER NOT NULL,
  gw NUMERIC(12,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
