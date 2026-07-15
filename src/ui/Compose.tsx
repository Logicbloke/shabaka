import { useState } from 'react'
import { composePost, composeReply, composeVoice } from '../state/store'
import { MAX_TEXT } from '../core/validate'
import { useT } from './i18n'
import { VoiceComposer } from './VoiceComposer'

export function Compose({ root, parent }: { root?: string; parent?: string }) {
  const t = useT()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const isReply = root !== undefined && parent !== undefined

  if (isReply && !open) {
    return (
      <button className="link reply-toggle" onClick={() => setOpen(true)}>
        {t('reply')}
      </button>
    )
  }

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
          .then(() => {
            setText('')
            setOpen(false)
          })
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
        autoFocus={isReply}
      />

      <div className="compose-actions">
        <button disabled={busy || !text.trim()}>{isReply ? t('reply') : t('post')}</button>
        {/* Voice is public posts only; skip it in reply mode. */}
        {!isReply && (
          <VoiceComposer
            onPost={(clip) => composeVoice(clip.blob, clip.dur, clip.mime)}
          />
        )}
      </div>

      {error && <p className="error">{error}</p>}
    </form>
  )
}
