"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronRight } from "lucide-react"
import { StatusBadge } from "@/components/ui/status-badge"
import type { DispatchContainer } from "@/lib/dispatch-data"

interface DispatchTableProps {
  data: DispatchContainer[]
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function DispatchTable({ data }: DispatchTableProps) {
  const router = useRouter()
  
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10"></TableHead>
            <TableHead>CONTAINER</TableHead>
            <TableHead>TYPE</TableHead>
            <TableHead>BOL</TableHead>
            <TableHead>SUPPLIER</TableHead>
            <TableHead>STATUS</TableHead>
            <TableHead>ETD</TableHead>
            <TableHead>ETA</TableHead>
            <TableHead className="text-right">QTY</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No containers found
              </TableCell>
            </TableRow>
          ) : (
            data.map((container) => (
              <TableRow
                key={container.id}
                className="group cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/container/${container.id}`)}
              >
                <TableCell>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/container/${container.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {container.container}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {container.type}
                  </span>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/bol/${container.bol}`}
                    className="font-mono text-sm text-muted-foreground hover:text-primary"
                  >
                    {container.bol.slice(0, 12)}...
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-primary">{container.supplier}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={container.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(container.etd)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(container.eta)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {container.totalQty.toLocaleString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
