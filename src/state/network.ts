import { NetworkManager } from '../core/net'
import { SyncManager } from '../core/sync'
import { coreEvents } from '../core/events'
import { getDb } from './store'
import type { Identity } from '../core/types'

let started = false

/**
 * Wired as store.setOnReady from main.tsx — starts P2P once an identity is
 * unlocked. Env overrides (all optional):
 *   VITE_STRATEGIES=mqtt        limit discovery strategies
 *   VITE_LOCAL_BROKER=1         mqtt → ws://localhost:9001 (offline testing)
 */
export async function startNetwork(identity: Identity): Promise<void> {
  if (started) return
  started = true

  const sync = new SyncManager(getDb, identity.pub, {
    onIngested: (msgs) => {
      for (const m of msgs) coreEvents.emit('message-ingested', m)
    },
    onBadPeer: (peerKey) => {
      console.warn('disconnected misbehaving peer', peerKey)
    },
  })

  const net = new NetworkManager({
    onPeer: (ch) => void sync.onPeerJoin(ch),
    onPeerGone: (key) => sync.onPeerLeave(key),
    onMessage: (ch, action, payload) => void sync.onMessage(ch, action, payload),
  })

  coreEvents.on('local-append', (msg) => {
    sync.push([msg])
    if (msg.type === 'follow' || msg.type === 'unfollow') {
      void sync.refreshInterest()
    }
  })

  const env = import.meta.env as Record<string, string | undefined>
  net.start({
    strategies: env.VITE_STRATEGIES?.split(','),
    mqttUrls: env.VITE_LOCAL_BROKER ? ['ws://localhost:9001'] : undefined,
  })

  setInterval(() => void sync.resyncAll(), 60_000)
}
