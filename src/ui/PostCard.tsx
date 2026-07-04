import { getProfile, getReactions, getThread } from '../core/db'
import { navigate, reactTo, useApp } from '../state/store'
import { formatTime, shortKey, useQuery } from './hooks'
import { useT } from './i18n'
import type { ReplyContent, StoredMessage } from '../core/types'

export function AuthorLink({ author }: { author: string }) {
  const profile = useQuery((db) => getProfile(db, author), [author])
  return (
    <button className="link author" onClick={() => navigate({ name: 'profile', author })}>
      {profile?.name || shortKey(author)}
    </button>
  )
}

export function PostCard({ msg, inThread }: { msg: StoredMessage; inThread?: boolean }) {
  const me = useApp((s) => s.identity)!
  const t = useT()
  const reactions = useQuery((db) => getReactions(db, msg.id), [msg.id])
  const replies = useQuery(
    (db) => (msg.type === 'post' ? getThread(db, msg.id) : Promise.resolve([])),
    [msg.id, msg.type],
  )

  const text = (msg.content as { text?: string }).text ?? ''
  const rootId = msg.type === 'reply' ? (msg.content as ReplyContent).root : msg.id

  const counts = new Map<string, number>()
  for (const r of reactions ?? []) {
    const emoji = (r.content as { emoji: string }).emoji
    counts.set(emoji, (counts.get(emoji) ?? 0) + 1)
  }
  const iReacted = (reactions ?? []).some((r) => r.author === me.pub)

  return (
    <article className="post">
      <div className="post-head">
        <AuthorLink author={msg.author} />
        <time>{formatTime(msg.displayTs)}</time>
        {msg.type === 'reply' && !inThread && (
          <button className="link" onClick={() => navigate({ name: 'thread', root: rootId })}>
            {t('inThread')}
          </button>
        )}
      </div>
      <p className="post-text" dir="auto">
        {text}
      </p>
      <div className="post-actions">
        {[...counts.entries()].map(([emoji, n]) => (
          <span key={emoji} className="reaction">
            {emoji} {n}
          </span>
        ))}
        <button
          className="link"
          disabled={iReacted}
          onClick={() => void reactTo(msg.id, '👍')}
          title={iReacted ? t('alreadyReacted') : t('react')}
        >
          👍
        </button>
        {!inThread && (
          <button className="link" onClick={() => navigate({ name: 'thread', root: rootId })}>
            💬 {replies?.length || ''}
          </button>
        )}
      </div>
    </article>
  )
}
