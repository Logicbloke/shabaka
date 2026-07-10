import { useState } from 'react'
import { getNotifications } from '../core/notifications'
import type { Notification } from '../core/notifications'
import { navigate, useApp } from '../state/store'
import { useQuery } from './hooks'
import { useT } from './i18n'
import { AuthorLink } from './PostCard'
import { TimeStamp } from './TimeStamp'
import { cleanText } from './text'
import type { TKey } from './i18n'

const EXCERPT_LEN = 140

function excerpt(text: string): string {
  const t = cleanText(text).replace(/\s+/g, ' ').trim()
  return t.length > EXCERPT_LEN ? t.slice(0, EXCERPT_LEN - 1) + '…' : t
}

function actionKey(n: Notification): TKey {
  if (n.kind === 'reply') return 'notifRepliedPost'
  return n.emoji && n.emoji !== '👍' ? 'notifReactedPost' : 'notifLikedPost'
}

/**
 * One notification's contents — shared by the notifications page and the live
 * toast. The excerpt of my post is a link into the thread it belongs to.
 */
export function NotificationBody({ n }: { n: Notification }) {
  const t = useT()
  const reply = n.replyText ? cleanText(n.replyText) : ''
  return (
    <>
      <div className="notif-head">
        <AuthorLink author={n.actor} hideKey />
        <span className="notif-action">{t(actionKey(n), { emoji: n.emoji ?? '' })}</span>
        <TimeStamp ts={n.ts} />
      </div>
      {n.kind === 'reply' && reply && (
        <p className="post-text" dir="auto">
          {reply}
        </p>
      )}
      <button
        className="notif-excerpt link"
        dir="auto"
        onClick={() => navigate({ name: 'thread', root: n.rootId })}
      >
        {n.kind === 'reply' && <span className="notif-on">{t('notifOnPost')} </span>}
        {excerpt(n.targetText)}
      </button>
    </>
  )
}

export function Notifications() {
  const me = useApp((s) => s.identity)!
  const t = useT()
  const [limit, setLimit] = useState(50)
  const notifs = useQuery((db) => getNotifications(db, me.pub, limit), [me.pub, limit])

  return (
    <div className="notifications">
      <h2>{t('notifTitle')}</h2>
      {notifs?.length === 0 && <p className="hint">{t('notifEmpty')}</p>}
      {notifs?.map((n) => (
        <article key={n.id} className="notif">
          <NotificationBody n={n} />
        </article>
      ))}
      {notifs && notifs.length >= limit && (
        <button onClick={() => setLimit((l) => l + 50)}>{t('loadMore')}</button>
      )}
    </div>
  )
}
