import { joinRoom as joinNostr } from '@trystero-p2p/nostr'
import { joinRoom as joinMqtt } from '@trystero-p2p/mqtt'
import { joinRoom as joinTorrent } from '@trystero-p2p/torrent'
import { coreEvents, type StrategyState } from './events'
import type { PeerChannel, SyncAction } from './sync'

const ACTIONS: SyncAction[] = ['hello', 'have', 'want', 'msgs']
const APP_ID = 'shabaka-v1'
const ROOM_ID = 'main'

export interface NetHandlers {
  onPeer(ch: PeerChannel): void
  onPeerGone(peerKey: string): void
  onMessage(ch: PeerChannel, action: SyncAction, payload: unknown): void
}

export interface NetOptions {
  /** limit to a subset of strategies (testing / env override) */
  strategies?: string[]
  /** point the mqtt strategy at a local broker for deterministic testing */
  mqttUrls?: string[]
}

interface MessageAction {
  send(data: unknown, options?: { target?: string }): Promise<void>
  onMessage: ((data: unknown, context: { peerId: string }) => void) | null
}

interface TrysteroRoom {
  makeAction(namespace: string): MessageAction
  onPeerJoin: ((peerId: string) => void) | null
  onPeerLeave: ((peerId: string) => void) | null
  leave(): Promise<void>
}

type JoinFn = (
  config: { appId: string } & Record<string, unknown>,
  roomId: string,
  callbacks?: { onJoinError?: (details: unknown) => void },
) => TrysteroRoom

/**
 * Joins the same logical room on several independent discovery
 * infrastructures. There is no single relay, broker, or tracker whose
 * blocking stops the network; each strategy failing is non-fatal by design.
 * Duplicate connections to the same person across strategies are handled at
 * the sync layer via session nonces and msgId dedupe.
 */
export class NetworkManager {
  private channels = new Map<string, PeerChannel>()
  private rooms: TrysteroRoom[] = []
  private counts = new Map<string, number>()

  constructor(private handlers: NetHandlers) {}

  start(options: NetOptions = {}): void {
    const defs: Array<{ name: string; join: JoinFn; config: Record<string, unknown> }> = [
      { name: 'nostr', join: joinNostr as unknown as JoinFn, config: {} },
      {
        name: 'mqtt',
        join: joinMqtt as unknown as JoinFn,
        config: options.mqttUrls ? { relayConfig: { urls: options.mqttUrls } } : {},
      },
      { name: 'torrent', join: joinTorrent as unknown as JoinFn, config: {} },
    ]
    for (const def of defs) {
      if (options.strategies && !options.strategies.includes(def.name)) continue
      this.joinStrategy(def.name, def.join, def.config)
    }
  }

  stop(): void {
    for (const room of this.rooms) {
      void room.leave().catch(() => undefined)
    }
    this.rooms = []
    this.channels.clear()
  }

  private status(strategy: string, state: StrategyState): void {
    coreEvents.emit('peer-status', {
      strategy,
      state,
      peerCount: this.counts.get(strategy) ?? 0,
    })
  }

  private joinStrategy(name: string, join: JoinFn, config: Record<string, unknown>): void {
    this.counts.set(name, 0)
    let room: TrysteroRoom
    try {
      room = join({ appId: APP_ID, ...config }, ROOM_ID, {
        onJoinError: () => this.status(name, 'failed'),
      })
    } catch {
      this.status(name, 'failed')
      return
    }
    this.rooms.push(room)

    const senders = new Map<SyncAction, MessageAction>()
    const keyOf = (peerId: string) => `${name}:${peerId}`

    for (const action of ACTIONS) {
      const messageAction = room.makeAction(action)
      senders.set(action, messageAction)
      messageAction.onMessage = (data, context) => {
        const ch = this.channels.get(keyOf(context.peerId))
        if (ch) this.handlers.onMessage(ch, action, data)
      }
    }

    room.onPeerJoin = (peerId) => {
      const key = keyOf(peerId)
      const ch: PeerChannel = {
        peerKey: key,
        send: (action, payload) =>
          void senders.get(action)!.send(payload, { target: peerId }).catch(() => undefined),
      }
      this.channels.set(key, ch)
      this.counts.set(name, (this.counts.get(name) ?? 0) + 1)
      this.status(name, 'connected')
      this.handlers.onPeer(ch)
    }

    room.onPeerLeave = (peerId) => {
      const key = keyOf(peerId)
      this.channels.delete(key)
      this.counts.set(name, Math.max(0, (this.counts.get(name) ?? 0) - 1))
      this.status(name, 'connected')
      this.handlers.onPeerGone(key)
    }

    this.status(name, 'connecting')
  }
}
