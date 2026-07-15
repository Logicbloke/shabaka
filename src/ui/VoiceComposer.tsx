import { useState } from 'react'
import { MAX_AUDIO_MS } from '../core/validate'
import { useT } from './i18n'
import { hasRecorder, isSecureForMedia, useVoiceRecorder, voiceErrorKey, type Clip } from './voice'

function clock(ms: number): string {
  const sec = Math.floor(ms / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/**
 * The record affordance shared by the feed composer and DM composer: a mic
 * button that grows into a recording bar and then a preview + post/discard.
 * Renders nothing where recording can't work (no MediaRecorder, or a non-secure
 * origin — the mic is blocked there anyway), so the icon is hidden in both places.
 */
export function VoiceComposer({ onPost }: { onPost: (clip: Clip) => Promise<void> }) {
  const t = useT()
  const voice = useVoiceRecorder()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!hasRecorder() || !isSecureForMedia()) return null

  async function post() {
    if (!voice.clip) return
    setBusy(true)
    setFailed(false)
    try {
      await onPost(voice.clip)
      voice.discard()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const errKey = voice.error ? voiceErrorKey(voice.error) : null

  return (
    <>
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
          <button type="button" disabled={busy} onClick={() => void post()}>
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

      {voice.status === 'idle' && (
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

      {(failed || errKey) && <p className="error">{failed ? t('msgRejected') : t(errKey!)}</p>}
    </>
  )
}
