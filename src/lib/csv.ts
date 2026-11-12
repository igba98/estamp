/** Spreadsheet-safe CSV: quotes every cell and defuses formulas (=, +, -, @). */
export function toCsv(rows: string[][]) {
  const cell = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
    return `"${safe.replace(/"/g, '""')}"`
  }
  return rows.map((r) => r.map(cell).join(",")).join("\r\n")
}
