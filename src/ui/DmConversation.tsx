import { useState } from 'react'
import { getDmMessages } from '../core/db'
import { openDm } from '../core/dm'
import { sendDm, useApp } from '../state/store'
import { useQuery } from './hooks'
import { TimeStamp } from './TimeStamp'
import { useT } from './i18n'
import { cleanText } from './text'
import { AuthorLink } from './PostCard'
import type { DmContent } from '../core/types'

export function DmConversation({ other }: { other: string }) {
  const me = useApp((s) => s.identity)!
  const t = useT()
  const dms = useQuery((db) => getDmMessages(db, me.pub), [me.pub])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
              <p dir="auto">{opened ? cleanText(opened.text) : t('cantDecrypt')}</p>
              <TimeStamp ts={m.displayTs} />
            </div>
          )
        })}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const trimmed = text.trim()
          if (!trimmed) return
          setBusy(true)
          setError(null)
          sendDm(other, trimmed)
            .then(() => setText(''))
            .catch(() => setError(t('msgRejected')))
            .finally(() => setBusy(false))
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
      {error && <p className="error">{error}</p>}
    </div>
  )
}
