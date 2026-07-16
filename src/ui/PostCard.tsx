import { useEffect, useRef, useState } from 'react'
import { getFollows, getProfile, getReactions, getThread } from '../core/db'
import { dedupeReactions } from '../core/reactions'
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

export function PostCard({
  msg,
  inThread,
  focused,
}: {
  msg: StoredMessage
  inThread?: boolean
  focused?: boolean
}) {
  const me = useApp((s) => s.identity)!
  const t = useT()
  const reactions = useQuery((db) => getReactions(db, msg.id), [msg.id])
  const follows = useQuery((db) => getFollows(db, me.pub), [me.pub])
  const replies = useQuery(
    (db) => (msg.type === 'post' ? getThread(db, msg.id) : Promise.resolve([])),
    [msg.id, msg.type],
  )

  const [linkCopied, setLinkCopied] = useState(false)

  // Scroll to and briefly highlight the post a notification deep-linked to.
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center' })
  }, [focused])

  const text = cleanText((msg.content as { text?: string }).text ?? '')
  const rootId = msg.type === 'reply' ? (msg.content as ReplyContent).root : msg.id
  const url = postUrl(rootId)

  // One reaction per (author, emoji) — a forked or misbehaving client can emit
  // the same "like" twice, and we don't want to count it twice.
  const unique = dedupeReactions(reactions ?? [])
  const counts = new Map<string, number>()
  for (const r of unique) {
    const emoji = cleanText((r.content as { emoji: string }).emoji)
    if (!emoji) continue
    counts.set(emoji, (counts.get(emoji) ?? 0) + 1)
  }
  const iReacted = unique.some((r) => r.author === me.pub)
  const likes = counts.get('👍') ?? 0

  // Name the people I follow who liked this — for everyone else I only have a
  // bare key, so they stay part of the count without being called out.
  const following = new Set((follows ?? []).filter((f) => f.following).map((f) => f.target))
  const likers = unique
    .filter((r) => (r.content as { emoji: string }).emoji === '👍')
    .map((r) => r.author)
    .filter((a) => a !== me.pub && following.has(a))

  return (
    <article className={focused ? 'post post-focused' : 'post'} ref={ref}>
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
      {likers.length > 0 && (
        <div className="reaction-likers">
          <span className="likers-label">👍 {t('likedBy')} </span>
          {likers.map((a, i) => (
            <span key={a}>
              {i > 0 && ', '}
              <AuthorLink author={a} hideKey />
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
