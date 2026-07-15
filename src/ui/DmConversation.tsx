import { useEffect, useState } from 'react'
import { getDmMessages } from '../core/db'
import { openDm } from '../core/dm'
import { composeVoiceDm, loadVoiceDmBytes, sendDm, useApp } from '../state/store'
import { useQuery } from './hooks'
import { TimeStamp } from './TimeStamp'
import { useT } from './i18n'
import { cleanText } from './text'
import { AuthorLink } from './PostCard'
import { VoiceComposer } from './VoiceComposer'
import type { DmAudioContent, DmContent, Identity, StoredMessage } from '../core/types'

function clock(ms: number): string {
  const sec = Math.round(ms / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** Reassembles + decrypts a voice DM, waiting on chunks as they sync in. */
function DmVoicePlayer({ me, msg }: { me: Identity; msg: StoredMessage }) {
  const t = useT()
  const content = msg.content as DmAudioContent
  const res = useQuery(() => loadVoiceDmBytes(me, msg), [msg.id])
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (res?.kind !== 'ok') {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(new Blob([res.bytes as BlobPart], { type: content.mime }))
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [res, content.mime])

  if (res?.kind === 'error') return <p dir="auto">{t('cantDecrypt')}</p>
  if (!url) return <p className="hint">{t('voiceLoading')}</p>
  return (
    <div className="voice-player">
      <audio controls src={url} aria-label={t('voiceMessage')} />
      <span className="voice-dur">{clock(content.dur)}</span>
    </div>
  )
}

export function DmConversation({ other }: { other: string }) {
  const me = useApp((s) => s.identity)!
  const t = useT()
  const dms = useQuery((db) => getDmMessages(db, me.pub), [me.pub])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const thread = (dms ?? [])
    .filter((m) => {
      const to = (m.content as DmContent | DmAudioContent).to
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
          const opened = m.type === 'dm-audio' ? null : openDm(me, m)
          return (
            <div key={m.id} className={m.author === me.pub ? 'dm mine' : 'dm theirs'}>
              {m.type === 'dm-audio' ? (
                <DmVoicePlayer me={me} msg={m} />
              ) : (
                <p dir="auto">{opened ? cleanText(opened.text) : t('cantDecrypt')}</p>
              )}
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
        <div className="compose-actions">
          <button disabled={busy || !text.trim()}>{t('send')}</button>
          <VoiceComposer
            onPost={(clip) => composeVoiceDm(other, clip.blob, clip.dur, clip.mime)}
          />
        </div>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
