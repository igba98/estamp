const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null

export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.round((ts - now) / 1000)
  const abs = Math.abs(s)
  if (!rtf) return new Date(ts).toLocaleString()
  if (abs < 45) return "just now"
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute")
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour")
  if (abs < 86400 * 7) return rtf.format(Math.round(s / 86400), "day")
  return formatDate(ts)
}

export function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

export function startOfWeek(d = new Date()) {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // Monday = 0
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - day)
  return x.getTime()
}
