import { useEffect, useState } from 'react'
import { getProfile, getReactions, getThread } from '../core/db'
import { loadVoiceBytes, navigate, postUrl, reactTo, useApp } from '../state/store'
import { shortKey, useQuery } from './hooks'
import { TimeStamp } from './TimeStamp'
import { useT } from './i18n'
import { cleanText, isRtlText } from './text'
import type { AudioContent, ReplyContent, StoredMessage } from '../core/types'

function clock(ms: number): string {
  const sec = Math.round(ms / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** Reassembles a voice clip from its chunk messages, waiting as they sync in. */
function VoicePlayer({ msg }: { msg: StoredMessage }) {
  const t = useT()
  const content = msg.content as AudioContent
  // Re-runs on every ingest (useQuery keys on dataVersion), so the clip
  // completes on its own as the author's chunk messages replicate.
  const bytes = useQuery(() => loadVoiceBytes(content), [msg.id])
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!bytes) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: content.mime }))
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [bytes, content.mime])

  if (!url) return <p className="hint">{t('voiceLoading')}</p>
  return (
    <div className="voice-player">
      <audio controls src={url} aria-label={t('voiceMessage')} />
      <span className="voice-dur">{clock(content.dur)}</span>
    </div>
  )
}

export function AuthorLink({ author, hideKey }: { author: string; hideKey?: boolean }) {
  const profile = useQuery((db) => getProfile(db, author), [author])
  const name = cleanText(profile?.name ?? '')
  return (
    <button
      className="link author"
      dir="auto"
      title={author}
      onClick={() => navigate({ name: 'profile', author })}
    >
      {name || shortKey(author)}
      {/* names are self-chosen and not unique — the key prefix is the identity.
          Callers that render the full key alongside pass hideKey to avoid repeating it. */}
      {name && !hideKey && <span className="key-suffix">{shortKey(author)}</span>}
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

  const [linkCopied, setLinkCopied] = useState(false)

  const text = cleanText((msg.content as { text?: string }).text ?? '')
  const rootId = msg.type === 'reply' ? (msg.content as ReplyContent).root : msg.id
  const url = postUrl(rootId)

  const counts = new Map<string, number>()
  for (const r of reactions ?? []) {
    const emoji = cleanText((r.content as { emoji: string }).emoji)
    if (!emoji) continue
    counts.set(emoji, (counts.get(emoji) ?? 0) + 1)
  }
  const iReacted = (reactions ?? []).some((r) => r.author === me.pub)
  const likes = counts.get('👍') ?? 0

  return (
    <article className="post">
      <div className="post-head">
        <AuthorLink author={msg.author} hideKey />
        <TimeStamp ts={msg.displayTs} />
        {msg.type === 'reply' && !inThread && (
          <button className="link" onClick={() => navigate({ name: 'thread', root: rootId })}>
            {t('inThread')}
          </button>
        )}
      </div>
      {msg.type === 'audio' ? (
        <VoicePlayer msg={msg} />
      ) : (
        <p className="post-text" dir="auto">
          {text}
        </p>
      )}
      {/* Row direction follows the post's own text so the link lands on the
          side opposite the 👍/reply group in both LTR and RTL posts. */}
      <div className="post-actions" dir={isRtlText(text) ? 'rtl' : 'ltr'}>
        {[...counts.entries()]
          .filter(([emoji]) => emoji !== '👍')
          .map(([emoji, n]) => (
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
          👍 {likes || ''}
        </button>
        {!inThread && (
          <button className="link" onClick={() => navigate({ name: 'thread', root: rootId })}>
            💬 {replies?.length || ''}
          </button>
        )}
        {url && (
          <a
            className="link post-link"
            href={url}
            title={linkCopied ? t('linkCopied') : t('copyLink')}
            aria-label={t('copyLink')}
            onClick={(e) => {
              // Copy the shareable link and open the thread in-app rather than
              // letting the browser follow the hash and reload the router.
              e.preventDefault()
              void navigator.clipboard?.writeText(url).then(() => {
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 1500)
              })
              navigate({ name: 'thread', root: rootId })
            }}
          >
            {linkCopied ? '✅' : '🔗'}
          </a>
        )}
      </div>
    </article>
  )
}
