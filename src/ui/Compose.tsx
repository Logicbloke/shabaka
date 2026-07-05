import { useState } from 'react'
import { composePost, composeReply } from '../state/store'
import { MAX_TEXT } from '../core/validate'
import { useT } from './i18n'

export function Compose({ root, parent }: { root?: string; parent?: string }) {
  const t = useT()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isReply = root !== undefined && parent !== undefined

  return (
    <form
      className="compose"
      onSubmit={(e) => {
        e.preventDefault()
        const trimmed = text.trim()
        if (!trimmed) return
        setBusy(true)
        setError(null)
        const action = isReply ? composeReply(root, parent, trimmed) : composePost(trimmed)
        action
          .then(() => setText(''))
          .catch(() => setError(t('msgRejected')))
          .finally(() => setBusy(false))
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={isReply ? t('replyPlaceholder') : t('composePlaceholder')}
        maxLength={MAX_TEXT}
        rows={isReply ? 2 : 3}
        dir="auto"
      />
      <button disabled={busy || !text.trim()}>{isReply ? t('reply') : t('post')}</button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
