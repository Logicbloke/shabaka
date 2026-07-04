import { getMessage, getThread } from '../core/db'
import { useQuery } from './hooks'
import { useT } from './i18n'
import { Compose } from './Compose'
import { PostCard } from './PostCard'
import type { ReplyContent, StoredMessage } from '../core/types'

function ReplyTree({
  parentId,
  root,
  byParent,
}: {
  parentId: string
  root: string
  byParent: Map<string, StoredMessage[]>
}) {
  const children = byParent.get(parentId) ?? []
  return (
    <>
      {children.map((r) => (
        <div key={r.id} className="reply-branch">
          <PostCard msg={r} inThread />
          <Compose root={root} parent={r.id} />
          <ReplyTree parentId={r.id} root={root} byParent={byParent} />
        </div>
      ))}
    </>
  )
}

export function Thread({ root }: { root: string }) {
  const t = useT()
  const rootMsg = useQuery((db) => getMessage(db, root), [root])
  const replies = useQuery((db) => getThread(db, root), [root])

  const byParent = new Map<string, StoredMessage[]>()
  for (const r of replies ?? []) {
    const parent = (r.content as ReplyContent).parent
    const list = byParent.get(parent) ?? []
    list.push(r)
    byParent.set(parent, list)
  }
  for (const list of byParent.values()) list.sort((a, b) => a.displayTs - b.displayTs)

  if (rootMsg === undefined) return <p className="hint">{t('loading')}</p>
  if (!rootMsg) {
    return <p className="hint">{t('threadNotSynced')}</p>
  }

  return (
    <div className="thread">
      <PostCard msg={rootMsg} inThread />
      <Compose root={root} parent={root} />
      <ReplyTree parentId={root} root={root} byParent={byParent} />
    </div>
  )
}
