import { useState } from 'react'
import {
  commitIdentity,
  importAndCommit,
  prepareIdentity,
  unlock,
  useApp,
  type Phase,
} from '../state/store'
import { translateError, useT } from './i18n'
import { LangToggle } from './App'
import { QrScanner, qrScanSupported } from './QrScanner'
import type { Identity } from '../core/types'

type Step =
  | { name: 'choose' }
  | { name: 'backup'; identity: Identity; backup: string }
  | { name: 'passphrase'; identity: Identity }
  | { name: 'import' }

export function Onboarding({ phase }: { phase: Phase }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const [step, setStep] = useState<Step>({ name: 'choose' })
  const [passphrase, setPassphrase] = useState('')
  const [backupInput, setBackupInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)

  const fail = (err: Error) => setError(translateError(lang, err.message))

  if (phase === 'loading') return <div className="onboarding">{t('obLoading')}</div>

  if (phase === 'locked') {
    return (
      <div className="onboarding">
        <LangToggle />
        <h1>{t('brand')}</h1>
        <p>{t('obLockedMsg')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            unlock(passphrase)
              .catch(fail)
              .finally(() => setBusy(false))
          }}
        >
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder={t('obPassphrase')}
            autoFocus
          />
          <button disabled={busy || !passphrase}>{busy ? t('obUnlocking') : t('obUnlock')}</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  // phase === 'fresh'
  if (step.name === 'choose') {
    return (
      <div className="onboarding">
        <LangToggle />
        <h1>{t('brand')}</h1>
        <p>{t('obIntro')}</p>
        <button onClick={() => setStep({ name: 'backup', ...prepareIdentity() })}>
          {t('obCreate')}
        </button>
        <button onClick={() => setStep({ name: 'import' })}>{t('obImportExisting')}</button>
      </div>
    )
  }

  if (step.name === 'backup') {
    return (
      <div className="onboarding">
        <h2>{t('obBackupTitle')}</h2>
        <p>{t('obBackupWarn')}</p>
        <code className="backup" dir="ltr">
          {step.backup}
        </code>
        <button onClick={() => setStep({ name: 'passphrase', identity: step.identity })}>
          {t('obSavedContinue')}
        </button>
      </div>
    )
  }

  if (step.name === 'passphrase') {
    return (
      <div className="onboarding">
        <h2>{t('obEncryptTitle')}</h2>
        <p>{t('obEncryptWarn')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setBusy(true)
            commitIdentity(step.identity, passphrase || undefined)
              .catch(fail)
              .finally(() => setBusy(false))
          }}
        >
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder={t('obPassOptionalPlaceholder')}
            autoFocus
          />
          <button disabled={busy}>
            {busy ? t('obSettingUp') : passphrase ? t('obEncryptStart') : t('obSkipStart')}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  // step.name === 'import'
  return (
    <div className="onboarding">
      <h2>{t('obImportTitle')}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setBusy(true)
          setError(null)
          importAndCommit(backupInput, passphrase || undefined)
            .catch(fail)
            .finally(() => setBusy(false))
        }}
      >
        <textarea
          value={backupInput}
          onChange={(e) => setBackupInput(e.target.value)}
          placeholder="shabaka-key-v1:…"
          dir="ltr"
          autoFocus
        />
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder={t('obImportPassPlaceholder')}
        />
        <button disabled={busy || !backupInput.trim()}>
          {busy ? t('obImporting') : t('obImport')}
        </button>
      </form>
      {qrScanSupported() && (
        <button className="link" onClick={() => setScanning(true)}>
          {t('qrScan')}
        </button>
      )}
      {error && <p className="error">{error}</p>}
      <button className="link" onClick={() => setStep({ name: 'choose' })}>
        {t('obBack')}
      </button>
      {scanning && (
        <QrScanner
          onResult={(text) => {
            setScanning(false)
            setBackupInput(text)
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  )
}
