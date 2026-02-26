import { notFound } from "next/navigation"
import { bolData, groupByBOL } from "@/lib/bol-data"
import { BOLDetail } from "@/components/dashboard/bol-detail"

interface BOLPageProps {
  params: Promise<{ id: string }>
}

export default async function BOLPage({ params }: BOLPageProps) {
  const { id } = await params
  const decodedId = decodeURIComponent(id)
  const allSummaries = groupByBOL(bolData)
  const summary = allSummaries.find((s) => s.bol === decodedId)

  if (!summary) {
    notFound()
  }

  return <BOLDetail summary={summary} />
}

export async function generateStaticParams() {
  const summaries = groupByBOL(bolData)
  return summaries.map((s) => ({ id: encodeURIComponent(s.bol) }))
}
