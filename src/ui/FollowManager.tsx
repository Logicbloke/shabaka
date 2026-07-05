import { useState } from 'react'
import { getFollows } from '../core/db'
import { B64URL_RE, B64_32 } from '../core/b64'
import { followKey, unfollowKey, useApp } from '../state/store'
import { useQuery } from './hooks'
import { useT } from './i18n'
import { AuthorLink } from './PostCard'
import { QrScanner, qrScanSupported } from './QrScanner'

export function FollowManager() {
  const me = useApp((s) => s.identity)!
  const t = useT()
  const follows = useQuery((db) => getFollows(db, me.pub), [me.pub])
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const active = (follows ?? []).filter((f) => f.following)

  const submitKey = (raw: string) => {
    const k = raw.trim()
    setError(null)
    // A scanned key-backup QR is a private key, never something to follow.
    if (k.startsWith('shabaka-key-v1:')) {
      setError(t('qrScanNotPubKey'))
      return
    }
    if (k.length !== B64_32 || !B64URL_RE.test(k)) {
      setError(t('badKey'))
      return
    }
    if (k === me.pub) {
      setError(t('ownKey'))
      return
    }
    void followKey(k).then(() => setKey(''))
  }

  return (
    <div className="follows">
      <h2>{t('followingTitle')}</h2>
      <p className="hint">{t('followsHint', { me: t('navMe') })}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitKey(key)
        }}
      >
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t('followPlaceholder')}
          dir="ltr"
        />
        <button disabled={!key.trim()}>{t('follow')}</button>
        {qrScanSupported() && (
          <button type="button" className="link" onClick={() => setScanning(true)}>
            {t('qrScan')}
          </button>
        )}
      </form>
      {error && <p className="error">{error}</p>}
      {scanning && (
        <QrScanner
          onResult={(text) => {
            setScanning(false)
            submitKey(text)
          }}
          onClose={() => setScanning(false)}
        />
      )}
      <ul className="follow-list">
        {active.map((f) => (
          <li key={f.target}>
            <div className="follow-row-head">
              <AuthorLink author={f.target} hideKey />
              <button className="link" onClick={() => void unfollowKey(f.target)}>
                {t('unfollow')}
              </button>
            </div>
            <code className="pubkey small" dir="ltr">
              {f.target}
            </code>
          </li>
        ))}
      </ul>
      {active.length === 0 && <p className="hint">{t('notFollowing')}</p>}
    </div>
  )
}
