/** UTC-päivä `YYYY-MM-DD` (sama haaste kaikille samana kalenteripäivänä UTC:ssä). */
export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Maanantai–sunnuntai UTC, palauttaa [start, end] date-stringeinä. */
export function utcWeekRange(ref = new Date()): { start: string; end: string } {
  const y = ref.getUTCFullYear()
  const m = ref.getUTCMonth()
  const day = ref.getUTCDate()
  const dow = ref.getUTCDay()
  const mondayOffset = (dow + 6) % 7
  const start = new Date(Date.UTC(y, m, day - mondayOffset))
  const end = new Date(Date.UTC(y, m, day - mondayOffset + 6))
  return { start: utcDayKey(start), end: utcDayKey(end) }
}

export function utcMonthRange(ref = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1))
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0))
  return { start: utcDayKey(start), end: utcDayKey(end) }
}
