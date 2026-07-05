import { useState } from 'react'
import { exportIdentity } from '../core/identity'
import { useApp } from '../state/store'
import { useT } from './i18n'
import { QrCode } from './QrCode'

export function Security() {
  const identity = useApp((s) => s.identity)!
  const t = useT()
  const [showBackup, setShowBackup] = useState(false)
  const [showQr, setShowQr] = useState(false)

  return (
    <div className="security">
      <h2>{t('secTitle')}</h2>

      <h3>{t('secBackupTitle')}</h3>
      {showBackup ? (
        <>
          <code className="backup" dir="ltr">
            {exportIdentity(identity)}
          </code>
          {/* The QR is a second deliberate step: it can be captured silently
              from a screenshot or across a room, unlike text you must read. */}
          {showQr ? (
            <div className="qr-block">
              <p className="error">⚠ {t('qrPrivWarn')}</p>
              <QrCode value={exportIdentity(identity)} />
            </div>
          ) : (
            <button onClick={() => setShowQr(true)}>{t('qrPrivReveal')}</button>
          )}
        </>
      ) : (
        <button onClick={() => setShowBackup(true)}>{t('secReveal')}</button>
      )}

      <h3>{t('secProtectsTitle')}</h3>
      <ul>
        <li>{t('secP1')}</li>
        <li>{t('secP2')}</li>
        <li>{t('secP3')}</li>
      </ul>

      <h3>{t('secNotTitle')}</h3>
      <ul>
        <li>
          <b>{t('secN1')}</b>
        </li>
        <li>{t('secN2')}</li>
        <li>{t('secN3')}</li>
        <li>{t('secN4')}</li>
        <li>{t('secN5')}</li>
      </ul>
    </div>
  )
}
