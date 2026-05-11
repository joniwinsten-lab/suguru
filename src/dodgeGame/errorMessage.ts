/**
 * Muuntaa heitetyn arvon luettavaksi virhetekstiksi.
 * React ei saa renderöidä objekteja suoraan — ja `new Error(obj)` / Supabase
 * voivat tuottaa viestin "[object Object]".
 */

/** Tunnistaa JS:n oletusobjektimerkkijonon ja yleiset variaatiot (välilyönnit, kirjainkoko). */
const GARBAGE_MESSAGE = /^\[object\s*[\w.]+\]$/i

function isGarbageMessage(s: string): boolean {
  const t = s.trim()
  if (t.length === 0) return true
  if (GARBAGE_MESSAGE.test(t)) return true
  const compact = t.replace(/\s+/g, '').toLowerCase()
  if (compact === 'objectobject' || compact === '[objectobject]') return true
  return false
}

function asText(v: unknown, depth: number): string {
  if (depth > 8) return '…'
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'bigint') return String(v)

  if (typeof v === 'object') {
    if (v instanceof Error) {
      return errorFromErrorInstance(v, depth + 1)
    }
    if (Array.isArray(v)) {
      return v.map((x) => asText(x, depth + 1)).filter(Boolean).join(' | ')
    }
    const o = v as Record<string, unknown>
    for (const key of ['message', 'error_description', 'details', 'hint', 'error', 'reason'] as const) {
      const inner = o[key]
      const s = asText(inner, depth + 1)
      if (s.length > 0 && !isGarbageMessage(s)) return s
    }
    if (o.code != null) {
      const code = asText(o.code, depth + 1)
      const det = asText(o.details, depth + 1)
      if (det.length > 0 && !isGarbageMessage(det)) return `${code}: ${det}`
      if (code.length > 0 && !isGarbageMessage(code)) return `Virhe (${code})`
    }
    try {
      return JSON.stringify(v)
    } catch {
      return ''
    }
  }

  try {
    return String(v)
  } catch {
    return ''
  }
}

function errorFromErrorInstance(err: Error, depth: number): string {
  const ext = err as Error & { details?: unknown; hint?: unknown; code?: unknown; cause?: unknown }
  let msg =
    typeof err.message === 'string'
      ? err.message
      : asText(err.message as unknown, depth + 1)
  if (isGarbageMessage(msg)) msg = ''

  const parts: string[] = []
  if (msg) parts.push(msg)

  const det = asText(ext.details, depth + 1)
  if (det && !isGarbageMessage(det)) parts.push(det)
  const hint = asText(ext.hint, depth + 1)
  if (hint && !isGarbageMessage(hint)) parts.push(hint)
  if (ext.code != null) {
    const c = asText(ext.code, depth + 1)
    if (c && !isGarbageMessage(c)) parts.push(`(${c})`)
  }

  if (parts.length > 0) return parts.join(' — ')

  if (ext.cause != null) {
    const c = asText(ext.cause, depth + 1)
    if (c) return c
  }

  if (err instanceof AggregateError && err.errors?.length) {
    return err.errors.map((e) => asText(e, depth + 1)).filter(Boolean).join(' | ')
  }

  try {
    const json = JSON.stringify(err, Object.getOwnPropertyNames(err))
    if (json && json !== '{}') return json
  } catch {
    /* ignore */
  }

  return err.name || 'Virhe'
}

export function errorToReadableString(e: unknown): string {
  if (e == null) return 'Tuntematon virhe'

  if (typeof e === 'string') {
    const t = e.trim()
    if (t.length === 0) return 'Tuntematon virhe'
    if (isGarbageMessage(t)) return 'Tuntematon virhe (palvelimen vastaus oli epäselvä).'
    return e
  }

  if (e instanceof Error) {
    const out = errorFromErrorInstance(e, 0).trim()
    return out.length > 0 ? out : 'Tuntematon virhe'
  }

  const out = asText(e, 0).trim()
  if (out.length === 0 || isGarbageMessage(out)) return 'Tuntematon virhe'
  return out
}

/** Kaikki käyttäjälle näytettävät virhetekstit — estää objektin renderöinnin ja "[object Object]". */
export function safeUiString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') {
    const t = value.trim()
    if (t.length === 0) return ''
    if (isGarbageMessage(t)) return 'Tuntematon virhe (palvelimen vastaus oli epäselvä).'
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'kyllä' : 'ei'
  return errorToReadableString(value)
}

/** Käytä catch-lohkossa ennen setStatea — varmistaa merkkijonon, ei koskaan objektia. */
export function caughtToUiMessage(e: unknown): string {
  const raw = errorToReadableString(e).trim()
  if (raw.length === 0 || isGarbageMessage(raw)) {
    if (typeof e === 'object' && e !== null && 'status' in e) {
      const st = (e as { status?: unknown }).status
      if (typeof st === 'number' || typeof st === 'string') {
        return `Verkko- tai palvelinvirhe (HTTP ${st}). Tarkista verkko ja Supabase-asetukset.`
      }
    }
    return 'Tuntematon virhe. Tarkista verkko, VITE_SUPABASE_URL / ANON_KEY ja RPC get_dodge_leaderboard.'
  }
  return raw
}
