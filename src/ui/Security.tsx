import { useState } from 'react'
import { exportIdentity } from '../core/identity'
import { useApp } from '../state/store'
import { useT } from './i18n'

export function Security() {
  const identity = useApp((s) => s.identity)!
  const t = useT()
  const [showBackup, setShowBackup] = useState(false)

  return (
    <div className="security">
      <h2>{t('secTitle')}</h2>

      <h3>{t('secBackupTitle')}</h3>
      {showBackup ? (
        <code className="backup" dir="ltr">
          {exportIdentity(identity)}
        </code>
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
