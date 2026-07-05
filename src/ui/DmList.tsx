import { useState } from 'react'
import { getDmMessages } from '../core/db'
import { B64URL_RE, B64_32 } from '../core/b64'
import { navigate, useApp } from '../state/store'
import { useQuery } from './hooks'
import { TimeStamp } from './TimeStamp'
import { useT } from './i18n'
import { AuthorLink } from './PostCard'
import type { DmContent } from '../core/types'

export function DmList() {
  const me = useApp((s) => s.identity)!
  const t = useT()
  const dms = useQuery((db) => getDmMessages(db, me.pub), [me.pub])
  const [key, setKey] = useState('')

  // newest message per counterparty
  const latest = new Map<string, number>()
  for (const m of dms ?? []) {
    const other = m.author === me.pub ? (m.content as DmContent).to : m.author
    latest.set(other, Math.max(latest.get(other) ?? 0, m.displayTs))
  }
  const conversations = [...latest.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="dms">
      <h2>{t('dmsTitle')}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const k = key.trim()
          if (k.length === B64_32 && B64URL_RE.test(k) && k !== me.pub) {
            navigate({ name: 'dm', other: k })
          }
        }}
      >
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t('dmStartPlaceholder')}
          dir="ltr"
        />
        <button disabled={!key.trim()}>{t('open')}</button>
      </form>
      <ul className="dm-list">
        {conversations.map(([other, ts]) => (
          <li key={other} onClick={() => navigate({ name: 'dm', other })}>
            <AuthorLink author={other} />
            <TimeStamp ts={ts} />
          </li>
        ))}
      </ul>
      {conversations.length === 0 && <p className="hint">{t('noConversations')}</p>}
    </div>
  )
}
