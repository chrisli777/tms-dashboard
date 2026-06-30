import pkg from "xlsx"
const { readFile, utils } = pkg
const wb = readFile("data/In-Transit-Report-for-Surin-Automotive-Issued-on-2026-06-17-7c681a.xlsx", { cellDates: true })
const ws = wb.Sheets[wb.SheetNames[0]]
const grid = utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false })
const hdrIdx = grid.findIndex((r) => r.some((c) => /hbl/i.test(String(c ?? ""))))
const headers = grid[hdrIdx].map((c) => String(c ?? "").trim())
console.log("hdrIdx", hdrIdx, "headers:", JSON.stringify(headers))
const col = (re) => headers.findIndex((h) => re.test(h))
const ataI = col(/^ata$/i), atdI = col(/atd/i)
const dataRows = grid.slice(hdrIdx + 1).filter((r) => r.some((c) => c != null && String(c).trim() !== ""))
const ne = (i) => dataRows.filter((r) => i >= 0 && r[i] != null && String(r[i]).trim() !== "").length
console.log("ATA idx", ataI, "count", ne(ataI), "| ATD idx", atdI, "count", ne(atdI), "| dataRows", dataRows.length)
