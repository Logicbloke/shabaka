import { useState } from 'react'
import { getAuthorMessages, getFollows, getHead, getProfile } from '../core/db'
import { followKey, saveProfile, unfollowKey, useApp } from '../state/store'
import { shortKey, useQuery } from './hooks'
import { useT } from './i18n'
import { cleanText } from './text'
import { PostCard } from './PostCard'
import { QrCode } from './QrCode'

function EditProfile({ name, bio }: { name: string; bio: string }) {
  const t = useT()
  const [n, setN] = useState(name)
  const [b, setB] = useState(bio)
  const [editing, setEditing] = useState(false)

  if (!editing) {
    return (
      <button className="link" onClick={() => setEditing(true)}>
        {t('editProfile')}
      </button>
    )
  }
  return (
    <form
      className="edit-profile"
      onSubmit={(e) => {
        e.preventDefault()
        void saveProfile(n.trim(), b.trim()).then(() => setEditing(false))
      }}
    >
      <input
        value={n}
        onChange={(e) => setN(e.target.value)}
        placeholder={t('displayName')}
        maxLength={64}
        dir="auto"
      />
      <textarea
        value={b}
        onChange={(e) => setB(e.target.value)}
        placeholder={t('bio')}
        maxLength={1024}
        rows={2}
        dir="auto"
      />
      <button>{t('save')}</button>
    </form>
  )
}

export function Profile({ author }: { author: string }) {
  const me = useApp((s) => s.identity)!
  const t = useT()
  const isSelf = author === me.pub
  const profile = useQuery((db) => getProfile(db, author), [author])
  const head = useQuery((db) => getHead(db, author), [author])
  const myFollows = useQuery((db) => getFollows(db, me.pub), [me.pub])
  const messages = useQuery((db) => getAuthorMessages(db, author), [author])
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)

  const following = (myFollows ?? []).some((f) => f.target === author && f.following)
  const posts = (messages ?? [])
    .filter((m) => m.type === 'post' || m.type === 'reply')
    .sort((a, b) => b.seq - a.seq)

  return (
    <div className="profile">
      <h2 dir="auto">{cleanText(profile?.name ?? '') || shortKey(author)}</h2>
      {head?.forked && <p className="error">{t('forkWarning')}</p>}
      {profile?.bio && (
        <p className="bio" dir="auto">
          {cleanText(profile.bio)}
        </p>
      )}
      <div className="pubkey-row">
        <code className="pubkey" dir="ltr">
          {author}
        </code>
        <button
          className="link"
          onClick={() => {
            void navigator.clipboard.writeText(author).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }}
        >
          {copied ? t('copied') : t('copyKey')}
        </button>
        <button className="link" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
          {showQr ? t('qrHide') : t('qrShow')}
        </button>
      </div>
      {showQr && (
        <div className="qr-block">
          <QrCode value={author} />
          <p className="hint">{t('qrPubHint')}</p>
        </div>
      )}
      {isSelf ? (
        <EditProfile name={profile?.name ?? ''} bio={profile?.bio ?? ''} />
      ) : (
        <button onClick={() => void (following ? unfollowKey(author) : followKey(author))}>
          {following ? t('unfollow') : t('follow')}
        </button>
      )}
      <h3>{t('messagesTotal', { n: head?.seq ?? 0 })}</h3>
      {posts.map((m) => (
        <PostCard key={m.id} msg={m} />
      ))}
    </div>
  )
}
