import { useApp } from '../state/store'
import { useT } from './i18n'

const DOT: Record<string, string> = {
  connected: '🟢',
  connecting: '🟡',
  failed: '🔴',
}

export function PeerStatus() {
  const peers = useApp((s) => s.peers)
  const t = useT()
  const entries = Object.entries(peers)

  if (entries.length === 0) {
    return <span className="peer-status">{t('peersLocalOnly')}</span>
  }
  const totalPeers = entries.reduce((n, [, v]) => n + v.peerCount, 0)
  return (
    <span className="peer-status" title={entries.map(([k, v]) => `${k}: ${v.state}`).join('\n')}>
      {entries.map(([k, v]) => (
        <span key={k} title={`${k}: ${v.state} (${v.peerCount})`}>
          {DOT[v.state] ?? '⚪'}
        </span>
      ))}{' '}
      {totalPeers === 1 ? t('peersOne') : t('peersMany', { n: totalPeers })}
    </span>
  )
}
