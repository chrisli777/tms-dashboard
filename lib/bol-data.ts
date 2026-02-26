export interface BOLRecord {
  supplier: string
  customer: string
  invoice: string
  bol: string
  whiPo: string
  container: string
  type: string
  sku: string
  qty: number
  gw: number
  unitPrice: number
  amount: number
  etd: string
  eta: string
  status: "Cleared" | "In Transit"
}

export interface ContainerGroup {
  container: string
  type: string
  status: "Cleared" | "In Transit"
  items: {
    sku: string
    whiPo: string
    qty: number
    unitPrice: number
    amount: number
    gw: number
  }[]
}

export interface BOLSummary {
  invoice: string
  bol: string
  supplier: string
  customer: string
  containerCount: number
  status: "Cleared" | "In Transit"
  etd: string
  eta: string
  totalAmount: number
  totalWeight: number
  poCount: number
  pos: string[]
  containers: ContainerGroup[]
}

export function groupByBOL(records: BOLRecord[]): BOLSummary[] {
  const map = new Map<string, BOLRecord[]>()
  for (const r of records) {
    const key = `${r.invoice}-${r.bol}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }

  const summaries: BOLSummary[] = []
  for (const [, group] of map) {
    const first = group[0]
    const uniqueContainers = [...new Set(group.map((r) => r.container))]
    const uniquePOs = [...new Set(group.map((r) => r.whiPo))]

    // Group containers
    const containerMap = new Map<string, BOLRecord[]>()
    for (const r of group) {
      if (!containerMap.has(r.container)) containerMap.set(r.container, [])
      containerMap.get(r.container)!.push(r)
    }

    const containers: ContainerGroup[] = []
    for (const [container, items] of containerMap) {
      containers.push({
        container,
        type: items[0].type,
        status: items[0].status,
        items: items.map((i) => ({
          sku: i.sku,
          whiPo: i.whiPo,
          qty: i.qty,
          unitPrice: i.unitPrice,
          amount: i.amount,
          gw: i.gw,
        })),
      })
    }

    summaries.push({
      invoice: first.invoice,
      bol: first.bol,
      supplier: first.supplier,
      customer: first.customer,
      containerCount: uniqueContainers.length,
      status: first.status,
      etd: first.etd,
      eta: first.eta,
      totalAmount: group.reduce((s, r) => s + r.amount, 0),
      totalWeight: group.reduce((s, r) => s + r.gw, 0),
      poCount: uniquePOs.length,
      pos: uniquePOs,
      containers,
    })
  }

  // Sort by ETD descending
  summaries.sort((a, b) => b.etd.localeCompare(a.etd))
  return summaries
}

export const bolData: BOLRecord[] = [
  { supplier: "AMC", customer: "Genie", invoice: "25111501", bol: "EGLV142503419969", whiPo: "699", container: "EGSU2417751", type: "40HQ", sku: "1260200", qty: 30, gw: 2135, unitPrice: 202.39, amount: 6071.70, etd: "2025-11-19", eta: "2025-12-19", status: "Cleared" },
  { supplier: "AMC", customer: "Genie", invoice: "25111501", bol: "EGLV142503419969", whiPo: "699", container: "EMCU8816472", type: "20G", sku: "229579", qty: 480, gw: 16660, unitPrice: 103.93, amount: 49886.40, etd: "2025-11-19", eta: "2025-12-19", status: "Cleared" },

  { supplier: "AMC", customer: "Genie", invoice: "25112801", bol: "COSU6437079380", whiPo: "700", container: "BSLU4000042", type: "40G", sku: "1260307", qty: 90, gw: 13970, unitPrice: 543.80, amount: 48942.00, etd: "2025-12-08", eta: "2026-01-07", status: "Cleared" },
  { supplier: "AMC", customer: "Genie", invoice: "25112801", bol: "COSU6437079380", whiPo: "700", container: "BSLU4000058", type: "40G", sku: "132525", qty: 80, gw: 4820, unitPrice: 207.55, amount: 16604.00, etd: "2025-12-08", eta: "2026-01-07", status: "Cleared" },
  { supplier: "AMC", customer: "Genie", invoice: "25112801", bol: "COSU6437079380", whiPo: "700", container: "BSLU4000079", type: "40G", sku: "229579", qty: 480, gw: 16660, unitPrice: 103.93, amount: 49886.40, etd: "2025-12-08", eta: "2026-01-07", status: "Cleared" },
  { supplier: "AMC", customer: "Genie", invoice: "25112801", bol: "COSU6437079380", whiPo: "700", container: "DTXU2062473", type: "20G", sku: "132525", qty: 10, gw: 610, unitPrice: 207.55, amount: 2075.50, etd: "2025-12-08", eta: "2026-01-07", status: "Cleared" },
  { supplier: "AMC", customer: "Genie", invoice: "25112801", bol: "COSU6437079380", whiPo: "700", container: "DTXU2062508", type: "20G", sku: "1264224", qty: 120, gw: 8520, unitPrice: 206.81, amount: 24817.20, etd: "2025-12-08", eta: "2026-01-07", status: "Cleared" },
  { supplier: "AMC", customer: "Genie", invoice: "25112801", bol: "COSU6437079380", whiPo: "700", container: "OOLU4364369", type: "40G", sku: "132517", qty: 96, gw: 7432, unitPrice: 218.02, amount: 20929.92, etd: "2025-12-08", eta: "2026-01-07", status: "Cleared" },
  { supplier: "AMC", customer: "Genie", invoice: "25112801", bol: "COSU6437079380", whiPo: "700", container: "SLEU2500362", type: "20G", sku: "132383", qty: 120, gw: 2720, unitPrice: 83.82, amount: 10058.40, etd: "2025-12-08", eta: "2026-01-07", status: "Cleared" },
  { supplier: "AMC", customer: "Genie", invoice: "25112801", bol: "COSU6437079380", whiPo: "700", container: "SLEU2500383", type: "20G", sku: "132385", qty: 120, gw: 2720, unitPrice: 83.82, amount: 10058.40, etd: "2025-12-08", eta: "2026-01-07", status: "Cleared" },
  { supplier: "AMC", customer: "Genie", invoice: "25112801", bol: "COSU6437079380", whiPo: "700", container: "SLEU2500547", type: "20G", sku: "1260200", qty: 90, gw: 6395, unitPrice: 202.39, amount: 18215.10, etd: "2025-12-08", eta: "2026-01-07", status: "Cleared" },
  { supplier: "AMC", customer: "Genie", invoice: "25112801", bol: "COSU6437079380", whiPo: "700", container: "SLEU2500552", type: "20G", sku: "1299483", qty: 30, gw: 3150, unitPrice: 322.18, amount: 9665.40, etd: "2025-12-08", eta: "2026-01-07", status: "Cleared" },

  { supplier: "AMC", customer: "Genie", invoice: "25120601", bol: "EGLV142503671901", whiPo: "714", container: "TXGU5704736", type: "40HQ", sku: "229579", qty: 480, gw: 16660, unitPrice: 103.93, amount: 49886.40, etd: "2025-12-13", eta: "2026-01-09", status: "Cleared" },
  { supplier: "AMC", customer: "Genie", invoice: "25120601", bol: "EGLV142503671901", whiPo: "714", container: "XXXU2500774", type: "20G", sku: "1260200", qty: 30, gw: 2135, unitPrice: 202.39, amount: 6071.70, etd: "2025-12-13", eta: "2026-01-09", status: "Cleared" },

  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "EGSU1124810", type: "40HQ", sku: "1260307", qty: 89, gw: 13816, unitPrice: 543.80, amount: 48398.20, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "EGSU1231905", type: "40HQ", sku: "229579", qty: 300, gw: 10410, unitPrice: 103.93, amount: 31179.00, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "720", container: "EGSU1231905", type: "40HQ", sku: "229579", qty: 200, gw: 6940, unitPrice: 103.93, amount: 20786.00, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "EGSU1439329", type: "40HQ", sku: "132517", qty: 75, gw: 5803, unitPrice: 218.02, amount: 16351.50, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "720", container: "EGSU1439329", type: "40HQ", sku: "132517", qty: 25, gw: 1934, unitPrice: 218.02, amount: 5450.50, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "EGSU1516322", type: "40HQ", sku: "229579", qty: 500, gw: 17350, unitPrice: 103.93, amount: 51965.00, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "EGSU6346511", type: "40HQ", sku: "132525", qty: 40, gw: 2409, unitPrice: 207.55, amount: 8302.00, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "720", container: "EGSU6346511", type: "40HQ", sku: "132525", qty: 25, gw: 1505, unitPrice: 207.55, amount: 5188.75, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "EISU9464661", type: "40HQ", sku: "1260200", qty: 120, gw: 8526, unitPrice: 202.39, amount: 24286.80, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "720", container: "EISU9464661", type: "40HQ", sku: "1260200", qty: 25, gw: 1776, unitPrice: 202.39, amount: 5059.75, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "EMCU1526698", type: "40HQ", sku: "1264224", qty: 120, gw: 8526, unitPrice: 206.81, amount: 24817.20, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "720", container: "EMCU1526698", type: "40HQ", sku: "1264224", qty: 25, gw: 1776, unitPrice: 206.81, amount: 5170.25, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "GCXU6428302", type: "40HQ", sku: "1260198", qty: 120, gw: 13446, unitPrice: 368.59, amount: 44230.80, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "720", container: "GCXU6428302", type: "40HQ", sku: "1260198", qty: 25, gw: 2801, unitPrice: 368.59, amount: 9214.75, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "OCGU8028460", type: "40HQ", sku: "132525", qty: 80, gw: 4820, unitPrice: 207.55, amount: 16604.00, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "TIIU5653194", type: "40HQ", sku: "1260307", qty: 31, gw: 4812, unitPrice: 543.80, amount: 16857.80, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "720", container: "TIIU5653194", type: "40HQ", sku: "1260307", qty: 25, gw: 3881, unitPrice: 543.80, amount: 13595.00, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "TXGU5648421", type: "40HQ", sku: "1299483", qty: 95, gw: 9975, unitPrice: 322.18, amount: 30607.10, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "720", container: "TXGU5648421", type: "40HQ", sku: "1299483", qty: 25, gw: 2625, unitPrice: 322.18, amount: 8054.50, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "VPLU3220052", type: "20G", sku: "132517", qty: 45, gw: 3487, unitPrice: 218.02, amount: 9810.90, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "VPLU3220068", type: "20G", sku: "132385", qty: 120, gw: 2724, unitPrice: 83.82, amount: 10058.40, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "720", container: "VPLU3220068", type: "20G", sku: "132385", qty: 25, gw: 567, unitPrice: 83.82, amount: 2095.50, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "VPLU3220073", type: "20G", sku: "229579", qty: 160, gw: 5560, unitPrice: 103.93, amount: 16628.80, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "VPLU3220089", type: "20G", sku: "1299483", qty: 25, gw: 2630, unitPrice: 322.18, amount: 8054.50, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "718", container: "VPLU3220094", type: "20G", sku: "132383", qty: 120, gw: 2724, unitPrice: 83.82, amount: 10058.40, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
  { supplier: "AMC", customer: "Genie", invoice: "26012301", bol: "EGLV142600024043", whiPo: "720", container: "VPLU3220094", type: "20G", sku: "132383", qty: 25, gw: 567, unitPrice: 83.82, amount: 2095.50, etd: "2026-01-28", eta: "2026-02-27", status: "In Transit" },
]
