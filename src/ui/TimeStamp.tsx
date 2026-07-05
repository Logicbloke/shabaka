import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/store'
import { formatAbsolute, formatRelative, useNow } from './hooks'

/**
 * A relative timestamp ("1m ago") that reveals the full absolute date and time
 * in a non-intrusive tooltip — on hover (desktop) or tap (mobile). The native
 * `title` attribute only works on hover, so we render our own tooltip and
 * toggle it on click for touch devices.
 */
export function TimeStamp({ ts }: { ts: number }) {
  const lang = useApp((s) => s.lang)
  const locale = lang === 'ar' ? 'ar' : undefined
  const now = useNow()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLTimeElement>(null)

  useEffect(() => {
    if (!open) return
    const onOutside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onOutside)
    return () => document.removeEventListener('pointerdown', onOutside)
  }, [open])

  return (
    <time
      ref={ref}
      className={'timestamp' + (open ? ' open' : '')}
      dateTime={new Date(ts).toISOString()}
      tabIndex={0}
      onClick={(e) => {
        // Rows in the DM list are clickable; a tap on the time should only
        // reveal the tooltip, not trigger the row's navigation.
        e.stopPropagation()
        setOpen((v) => !v)
      }}
      onBlur={() => setOpen(false)}
    >
      {formatRelative(ts, now, locale)}
      <span className="timestamp-tip" role="tooltip">
        {formatAbsolute(ts, locale)}
      </span>
    </time>
  )
}
