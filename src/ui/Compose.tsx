import { useMemo, useState } from 'react'
import { composePost, composeReply, composeVoice } from '../state/store'
import { MAX_AUDIO_MS, MAX_TEXT } from '../core/validate'
import { useT } from './i18n'
import { detectVoice, useVoiceRecorder } from './voice'

function clock(ms: number): string {
  const sec = Math.floor(ms / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export function Compose({ root, parent }: { root?: string; parent?: string }) {
  const t = useT()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const isReply = root !== undefined && parent !== undefined
  const voice = useVoiceRecorder()
  // Voice is public posts only; skip it in reply mode and where unsupported.
  const canRecord = useMemo(() => !isReply && detectVoice().supported, [isReply])

  if (isReply && !open) {
    return (
      <button className="link reply-toggle" onClick={() => setOpen(true)}>
        {t('reply')}
      </button>
    )
  }

  async function postVoice() {
    if (!voice.clip) return
    setBusy(true)
    setError(null)
    try {
      await composeVoice(voice.clip.blob, voice.clip.dur, voice.clip.mime)
      voice.discard()
    } catch {
      setError(t('msgRejected'))
    } finally {
      setBusy(false)
    }
  }

  const voiceError =
    voice.error === 'denied'
      ? t('micDenied')
      : voice.error === 'unsupported'
        ? t('voiceUnsupported')
        : null

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

      {voice.status === 'recording' && (
        <div className="voice-bar">
          <span className="voice-timer" aria-live="polite">
            ● {clock(voice.elapsed)} / {clock(MAX_AUDIO_MS)}
          </span>
          <button type="button" onClick={voice.stop}>
            {t('stopRecording')}
          </button>
        </div>
      )}

      {voice.status === 'preview' && voice.clip && (
        <div className="voice-bar">
          <audio controls src={voice.clip.url} />
          <button type="button" disabled={busy} onClick={postVoice}>
            {t('postVoice')}
          </button>
          <button
            type="button"
            className="link"
            disabled={busy}
            onClick={voice.discard}
            aria-label={t('discardRecording')}
          >
            ✕
          </button>
        </div>
      )}

      <div className="compose-actions">
        <button disabled={busy || !text.trim()}>{isReply ? t('reply') : t('post')}</button>
        {canRecord && voice.status === 'idle' && (
          <button
            type="button"
            className="record-btn"
            disabled={busy}
            onClick={() => void voice.start()}
            aria-label={t('record')}
            title={t('record')}
          >
            🎙️
          </button>
        )}
      </div>

      {(error || voiceError) && <p className="error">{error ?? voiceError}</p>}
    </form>
  )
}
