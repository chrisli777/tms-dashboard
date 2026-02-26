import { notFound } from "next/navigation"
import { fetchBOLByBol } from "@/lib/bol-data"
import { BOLDetail } from "@/components/dashboard/bol-detail"

interface BOLPageProps {
  params: Promise<{ id: string }>
}

export default async function BOLPage({ params }: BOLPageProps) {
  const { id } = await params
  const decodedId = decodeURIComponent(id)
  const summary = await fetchBOLByBol(decodedId)

  if (!summary) {
    notFound()
  }

  return <BOLDetail summary={summary} />
}
