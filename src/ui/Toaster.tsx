import { useCallback, useEffect, useState } from 'react'
import { coreEvents } from '../core/events'
import { notificationForMessage, type Notification } from '../core/notifications'
import { useApp, withDb } from '../state/store'
import { useT } from './i18n'
import { NotificationBody } from './Notifications'

// Only toast messages fresh enough to be genuinely live — this filters out the
// backfill burst of old likes/replies that arrives when we first connect/sync.
const FRESH_WINDOW_MS = 2 * 60_000
const AUTO_DISMISS_MS = 8000
const MAX_TOASTS = 4

function Toast({ n, onClose }: { n: Notification; onClose: (id: string) => void }) {
  const t = useT()
  useEffect(() => {
    const timer = setTimeout(() => onClose(n.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [n.id, onClose])

  return (
    <div className="toast" role="status">
      <button className="toast-close" aria-label={t('notifClose')} onClick={() => onClose(n.id)}>
        ✕
      </button>
      <NotificationBody n={n} />
    </div>
  )
}

/**
 * Live notification toasts, stacked on the end (right in LTR) side of the
 * screen. Only shown while connected and looking at the feed — the notifications
 * page is where the full history lives; toasts are the in-the-moment nudge.
 */
export function Toaster() {
  const [toasts, setToasts] = useState<Notification[]>([])

  const remove = useCallback((id: string) => {
    setToasts((cur) => cur.filter((x) => x.id !== id))
  }, [])

  useEffect(() => {
    return coreEvents.on('message-ingested', (m) => {
      const st = useApp.getState()
      if (!st.identity || st.view.name !== 'feed') return
      if (m.author === st.identity.pub) return
      if (m.displayTs < Date.now() - FRESH_WINDOW_MS) return
      const connected = Object.values(st.peers).some((p) => p.state === 'connected')
      if (!connected) return

      const selfPub = st.identity.pub
      void withDb((db) => notificationForMessage(db, selfPub, m)).then((n) => {
        if (!n) return
        setToasts((cur) =>
          cur.some((x) => x.id === n.id) ? cur : [...cur, n].slice(-MAX_TOASTS),
        )
      })
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((n) => (
        <Toast key={n.id} n={n} onClose={remove} />
      ))}
    </div>
  )
}
