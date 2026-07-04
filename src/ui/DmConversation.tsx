import { useState } from 'react'
import { getDmMessages } from '../core/db'
import { openDm } from '../core/dm'
import { sendDm, useApp } from '../state/store'
import { formatTime, useQuery } from './hooks'
import { useT } from './i18n'
import { AuthorLink } from './PostCard'
import type { DmContent } from '../core/types'

export function DmConversation({ other }: { other: string }) {
  const me = useApp((s) => s.identity)!
  const t = useT()
  const dms = useQuery((db) => getDmMessages(db, me.pub), [me.pub])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const thread = (dms ?? [])
    .filter((m) => {
      const to = (m.content as DmContent).to
      return (m.author === me.pub && to === other) || (m.author === other && to === me.pub)
    })
    .sort((a, b) => a.displayTs - b.displayTs)

  return (
    <div className="dm-conversation">
      <h2>
        <AuthorLink author={other} />
      </h2>
      <p className="hint">{t('dmHint')}</p>
      <div className="dm-messages">
        {thread.map((m) => {
          const opened = openDm(me, m)
          return (
            <div key={m.id} className={m.author === me.pub ? 'dm mine' : 'dm theirs'}>
              <p dir="auto">{opened ? opened.text : t('cantDecrypt')}</p>
              <time>{formatTime(m.displayTs)}</time>
            </div>
          )
        })}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const t = text.trim()
          if (!t) return
          setBusy(true)
          void sendDm(other, t).then(() => {
            setText('')
            setBusy(false)
          })
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('dmPlaceholder')}
          rows={2}
          dir="auto"
        />
        <button disabled={busy || !text.trim()}>{t('send')}</button>
      </form>
    </div>
  )
}
