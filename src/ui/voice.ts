import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_AUDIO_MS } from '../core/validate'

/**
 * Browser voice recording. `mime` is the base container stored in the audio
 * manifest (must be one of validate.ts `AUDIO_MIMES`); `recorderMime` is the
 * fuller string handed to MediaRecorder for codec selection. Ordered best-first.
 */
const CANDIDATES: [recorderMime: string, container: string][] = [
  ['audio/webm;codecs=opus', 'audio/webm'],
  ['audio/webm', 'audio/webm'],
  ['audio/ogg;codecs=opus', 'audio/ogg'],
  ['audio/mp4', 'audio/mp4'], // Safari / iOS
]

export interface VoiceSupport {
  supported: boolean
  /** container mime for the manifest, or null when unsupported */
  mime: string | null
  /** exact mimeType for MediaRecorder */
  recorderMime: string | null
}

/**
 * Feature-detect recording. Requires getUserMedia + MediaRecorder + a container
 * we can name for playback. Returns unsupported (so the UI hides the mic) when
 * any is missing — e.g. getUserMedia is often unavailable from `file://`.
 */
export function detectVoice(): VoiceSupport {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return { supported: false, mime: null, recorderMime: null }
  }
  for (const [recorderMime, mime] of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(recorderMime)) return { supported: true, mime, recorderMime }
  }
  return { supported: false, mime: null, recorderMime: null }
}

export type RecorderStatus = 'idle' | 'recording' | 'preview'
/**
 * - `insecure`: not a secure context — getUserMedia is blocked on plain http://
 *   origins (anything but https:// or localhost) and never even prompts
 * - `denied`: the user (or a remembered decision) refused the mic
 * - `nomic`: no microphone available / in use by another app
 * - `unsupported`: no MediaRecorder or no encodable container
 * - `error`: anything else
 */
export type RecorderError = 'insecure' | 'denied' | 'nomic' | 'unsupported' | 'error'

/**
 * getUserMedia needs a secure context. Browsers expose this as
 * `window.isSecureContext`; on insecure origins some also drop
 * `navigator.mediaDevices` entirely, so treat a missing entry point the same.
 */
export function isSecureForMedia(): boolean {
  if (typeof window !== 'undefined' && window.isSecureContext === false) return false
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

/**
 * Whether to offer the record control at all. Deliberately lenient — if the
 * browser has MediaRecorder we show the button and let `start()` report the
 * precise reason (insecure origin, denied, no mic) rather than hiding the
 * feature silently, which just looks broken.
 */
export function hasRecorder(): boolean {
  return typeof MediaRecorder !== 'undefined'
}

export interface Clip {
  blob: Blob
  /** object URL for the preview <audio>; owned by the hook, revoked on discard/unmount */
  url: string
  mime: string
  /** length in ms, clamped to MAX_AUDIO_MS */
  dur: number
}

export interface VoiceRecorder {
  status: RecorderStatus
  /** elapsed ms while recording */
  elapsed: number
  clip: Clip | null
  error: RecorderError | null
  start: () => Promise<void>
  stop: () => void
  discard: () => void
}

/**
 * Stateful mic recorder for the composer: idle → recording (auto-stops at
 * MAX_AUDIO_MS) → preview. Owns the MediaStream, the elapsed timer, and the
 * preview object URL, releasing all of them on discard and on unmount.
 */
export function useVoiceRecorder(): VoiceRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [clip, setClip] = useState<Clip | null>(null)
  const [error, setError] = useState<RecorderError | null>(null)

  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const startedRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clipRef = useRef<Clip | null>(null)
  clipRef.current = clip

  const teardownStream = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recRef.current = null
  }, [])

  const start = useCallback(async () => {
    // Check this first: on a plain http:// origin the browser blocks the mic
    // outright and never prompts, which otherwise looks like a flat "denied".
    if (!isSecureForMedia()) {
      setError('insecure')
      return
    }
    const support = detectVoice()
    if (!support.supported || !support.mime) {
      setError('unsupported')
      return
    }
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      if (name === 'SecurityError') setError('insecure')
      else if (name === 'NotAllowedError') setError('denied')
      else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError')
        setError('nomic')
      else setError('error')
      return
    }
    streamRef.current = stream
    const opts: MediaRecorderOptions = { audioBitsPerSecond: 24000 }
    if (support.recorderMime) opts.mimeType = support.recorderMime
    const rec = new MediaRecorder(stream, opts)
    const parts: BlobPart[] = []
    rec.ondataavailable = (e) => {
      if (e.data.size) parts.push(e.data)
    }
    rec.onstop = () => {
      const dur = Math.min(Date.now() - startedRef.current, MAX_AUDIO_MS)
      const blob = new Blob(parts, { type: support.mime! })
      teardownStream()
      if (!blob.size) {
        setStatus('idle')
        return
      }
      setClip({ blob, url: URL.createObjectURL(blob), mime: support.mime!, dur })
      setStatus('preview')
    }
    recRef.current = rec
    startedRef.current = Date.now()
    setElapsed(0)
    rec.start()
    setStatus('recording')
    timerRef.current = setInterval(() => setElapsed(Date.now() - startedRef.current), 200)
    autoStopRef.current = setTimeout(() => {
      if (rec.state !== 'inactive') rec.stop()
    }, MAX_AUDIO_MS)
  }, [teardownStream])

  const stop = useCallback(() => {
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  const discard = useCallback(() => {
    if (clipRef.current) URL.revokeObjectURL(clipRef.current.url)
    setClip(null)
    setElapsed(0)
    setStatus('idle')
  }, [])

  useEffect(
    () => () => {
      teardownStream()
      if (clipRef.current) URL.revokeObjectURL(clipRef.current.url)
    },
    [teardownStream],
  )

  return { status, elapsed, clip, error, start, stop, discard }
}
