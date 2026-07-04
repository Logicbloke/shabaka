import { useMemo, useState } from 'react'
import { getFollows, getTimeline } from '../core/db'
import { useApp } from '../state/store'
import { useQuery } from './hooks'
import { useT } from './i18n'
import { Compose } from './Compose'
import { PostCard } from './PostCard'

export function Feed() {
  const me = useApp((s) => s.identity)!
  const t = useT()
  const [limit, setLimit] = useState(50)

  const follows = useQuery((db) => getFollows(db, me.pub), [me.pub])
  const authors = useMemo(
    () =>
      new Set([
        me.pub,
        ...(follows ?? []).filter((f) => f.following).map((f) => f.target),
      ]),
    [me.pub, follows],
  )
  const messages = useQuery(
    (db) => getTimeline(db, authors, Infinity, limit),
    [authors, limit],
  )

  return (
    <div className="feed">
      <Compose />
      {messages?.length === 0 && <p className="hint">{t('feedEmpty')}</p>}
      {messages?.map((m) => <PostCard key={m.id} msg={m} />)}
      {messages && messages.length >= limit && (
        <button onClick={() => setLimit((l) => l + 50)}>{t('loadMore')}</button>
      )}
    </div>
  )
}
