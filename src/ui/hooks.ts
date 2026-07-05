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

export function formatTime(ts: number): string {
  const locale = useApp.getState().lang === 'ar' ? 'ar' : undefined
  const d = new Date(ts)
  const now = Date.now()
  if (now - ts < 24 * 3600_000) {
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}
