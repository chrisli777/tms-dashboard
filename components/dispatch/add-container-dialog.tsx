"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WAREHOUSE_OPTIONS, VENDOR_OPTIONS } from "@/lib/dispatch-options"
import { DISPATCH_STATUS_OPTIONS, dispatchTokenFromLabel } from "@/lib/status"

const NONE = "__none__"

const emptyForm = {
  container: "",
  containerType: "",
  supplier: "",
  customer: "",
  bol: "",
  invoice: "",
  warehouse: "",
  vendor: "",
  dispatchStatus: "Arrived",
  etd: "",
  atd: "",
  eta: "",
  ata: new Date().toISOString().slice(0, 10),
  lfd: "",
  plannedPickupDate: "",
  sku: "",
  po: "",
  quantity: "",
  grossWeight: "",
  totalAmount: "",
}

type FormState = typeof emptyForm

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function AddContainerDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.container.trim()) {
      setError("Container number is required")
      return
    }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch("/api/dispatch/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // Convert the friendly dispatch label to the stored token.
          dispatchStatus: dispatchTokenFromLabel(form.dispatchStatus),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Failed to add container")
        setSaving(false)
        return
      }
      setForm(emptyForm)
      setOpen(false)
      router.refresh()
    } catch {
      setError("Failed to add container")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Add Container
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Container</DialogTitle>
          <DialogDescription>
            Manually track a standalone container. It appears in the Dispatcher once it has an
            arrival date (ATA), which defaults to today.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Identity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Container number *">
              <Input
                value={form.container}
                onChange={(e) => set("container", e.target.value)}
                placeholder="MSKU1234567"
                required
                autoFocus
              />
            </Field>
            <Field label="Container type">
              <Input
                value={form.containerType}
                onChange={(e) => set("containerType", e.target.value)}
                placeholder="40HC"
              />
            </Field>
            <Field label="Supplier">
              <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
            </Field>
            <Field label="Customer">
              <Input value={form.customer} onChange={(e) => set("customer", e.target.value)} />
            </Field>
            <Field label="BOL number">
              <Input value={form.bol} onChange={(e) => set("bol", e.target.value)} />
            </Field>
            <Field label="Invoice number">
              <Input value={form.invoice} onChange={(e) => set("invoice", e.target.value)} />
            </Field>
          </div>

          {/* Dispatch assignment */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Warehouse">
              <Select
                value={form.warehouse || NONE}
                onValueChange={(v) => set("warehouse", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Auto (by SKU)</SelectItem>
                  {WAREHOUSE_OPTIONS.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Vendor">
              <Select
                value={form.vendor || NONE}
                onValueChange={(v) => set("vendor", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {VENDOR_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.dispatchStatus} onValueChange={(v) => set("dispatchStatus", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPATCH_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="ETD">
              <Input type="date" value={form.etd} onChange={(e) => set("etd", e.target.value)} />
            </Field>
            <Field label="ATD">
              <Input type="date" value={form.atd} onChange={(e) => set("atd", e.target.value)} />
            </Field>
            <Field label="ETA">
              <Input type="date" value={form.eta} onChange={(e) => set("eta", e.target.value)} />
            </Field>
            <Field label="ATA">
              <Input type="date" value={form.ata} onChange={(e) => set("ata", e.target.value)} />
            </Field>
            <Field label="LFD">
              <Input type="date" value={form.lfd} onChange={(e) => set("lfd", e.target.value)} />
            </Field>
            <Field label="Planned pickup">
              <Input
                type="date"
                value={form.plannedPickupDate}
                onChange={(e) => set("plannedPickupDate", e.target.value)}
              />
            </Field>
          </div>

          {/* Optional line item */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="SKU">
              <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} />
            </Field>
            <Field label="PO number">
              <Input value={form.po} onChange={(e) => set("po", e.target.value)} />
            </Field>
            <Field label="Quantity">
              <Input
                type="number"
                inputMode="numeric"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </Field>
            <Field label="Gross weight (kg)">
              <Input
                type="number"
                inputMode="decimal"
                value={form.grossWeight}
                onChange={(e) => set("grossWeight", e.target.value)}
              />
            </Field>
            <Field label="Amount (USD)">
              <Input
                type="number"
                inputMode="decimal"
                value={form.totalAmount}
                onChange={(e) => set("totalAmount", e.target.value)}
              />
            </Field>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Adding..." : "Add Container"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
