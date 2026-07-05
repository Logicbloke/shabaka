import { useEffect, useState } from 'react'
import { useApp, withDb } from '../state/store'
import type { ShabakaDb } from '../core/db'

/**
 * Run a DB query, re-running whenever any message is ingested (dataVersion)
 * or the deps change. Fine at v1 scale; queries are indexed and cheap.
 */
export function useQuery<T>(
  fn: (db: ShabakaDb) => Promise<T>,
  deps: unknown[],
): T | undefined {
  const version = useApp((s) => s.dataVersion)
  const [value, setValue] = useState<T>()
  useEffect(() => {
    let live = true
    void withDb(fn).then((v) => {
      if (live) setValue(v)
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])
  return value
}

export function shortKey(pub: string): string {
  return pub.slice(0, 8) + '…'
}

/**
 * A single shared clock so that N on-screen relative timestamps ("1m ago")
 * re-render off one interval instead of one timer each. Ticks every 30s —
 * fine-grained enough for a feed, cheap enough to leave running.
 */
const tickListeners = new Set<() => void>()
let tickTimer: ReturnType<typeof setInterval> | undefined

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const cb = () => setNow(Date.now())
    tickListeners.add(cb)
    if (!tickTimer) {
      tickTimer = setInterval(() => tickListeners.forEach((l) => l()), 30_000)
    }
    return () => {
      tickListeners.delete(cb)
      if (tickListeners.size === 0 && tickTimer) {
        clearInterval(tickTimer)
        tickTimer = undefined
      }
    }
  }, [])
  return now
}

const REL_UNITS: [ms: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [1000, 'second'],
  [60_000, 'minute'],
  [3600_000, 'hour'],
  [86_400_000, 'day'],
  [7 * 86_400_000, 'week'],
  [30 * 86_400_000, 'month'],
  [365 * 86_400_000, 'year'],
]

/** Compact relative time, e.g. "1m ago" / "3d ago" (localized; Arabic-aware). */
export function formatRelative(ts: number, now: number, locale?: string): string {
  // Never read as the future: clock skew can date a message slightly ahead.
  const diff = Math.min(ts - now, -1000)
  let ms = 1000
  let unit: Intl.RelativeTimeFormatUnit = 'second'
  for (const [next, u] of REL_UNITS) {
    if (Math.abs(diff) < next) break
    ms = next
    unit = u
  }
  const rtf = new Intl.RelativeTimeFormat(locale ?? 'en', { numeric: 'always', style: 'narrow' })
  return rtf.format(Math.round(diff / ms), unit)
}

/** Full absolute date + time for the tooltip, e.g. "Sunday, 27 October 2024 at 4:33 AM". */
export function formatAbsolute(ts: number, locale?: string): string {
  return new Date(ts).toLocaleString(locale, { dateStyle: 'full', timeStyle: 'short' })
}
