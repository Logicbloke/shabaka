import { useState } from 'react'
import { getFollows } from '../core/db'
import { B64URL_RE, B64_32 } from '../core/b64'
import { followKey, unfollowKey, useApp } from '../state/store'
import { useQuery } from './hooks'
import { useT } from './i18n'
import { AuthorLink } from './PostCard'

export function FollowManager() {
  const me = useApp((s) => s.identity)!
  const t = useT()
  const follows = useQuery((db) => getFollows(db, me.pub), [me.pub])
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const active = (follows ?? []).filter((f) => f.following)

  return (
    <div className="follows">
      <h2>{t('followingTitle')}</h2>
      <p className="hint">{t('followsHint', { me: t('navMe') })}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const k = key.trim()
          setError(null)
          if (k.length !== B64_32 || !B64URL_RE.test(k)) {
            setError(t('badKey'))
            return
          }
          if (k === me.pub) {
            setError(t('ownKey'))
            return
          }
          void followKey(k).then(() => setKey(''))
        }}
      >
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t('followPlaceholder')}
          dir="ltr"
        />
        <button disabled={!key.trim()}>{t('follow')}</button>
      </form>
      {error && <p className="error">{error}</p>}
      <ul className="follow-list">
        {active.map((f) => (
          <li key={f.target}>
            <AuthorLink author={f.target} />
            <code className="pubkey small" dir="ltr">
              {f.target}
            </code>
            <button className="link" onClick={() => void unfollowKey(f.target)}>
              {t('unfollow')}
            </button>
          </li>
        ))}
      </ul>
      {active.length === 0 && <p className="hint">{t('notFollowing')}</p>}
    </div>
  )
}
