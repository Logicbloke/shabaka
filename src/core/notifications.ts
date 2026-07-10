import { getAuthorMessages, getMessage, type ShabakaDb } from './db'
import type { ReactionContent, ReplyContent, StoredMessage } from './types'

/**
 * In-app notifications: reactions ("like") and replies ("comment") that other
 * people made on one of my own posts/replies. Derived on demand from the log —
 * nothing extra is persisted. Raw text is carried through untouched; the UI
 * sanitizes and truncates it at render time (core stays framework-agnostic and
 * signed envelopes are never rewritten).
 */

export type NotifKind = 'like' | 'reply'

export interface Notification {
  /** msgId of the reaction/reply that triggered this — a stable React key */
  id: string
  kind: NotifKind
  /** pubkey of whoever liked/replied */
  actor: string
  /** displayTs of the triggering message (used for ordering + "1m ago") */
  ts: number
  /** thread root to open when the notification is tapped */
  rootId: string
  /** raw text of my post/reply that was acted on */
  targetText: string
  /** raw text of the reply (kind === 'reply') */
  replyText?: string
  /** reaction emoji (kind === 'like') */
  emoji?: string
}

/** Build a Notification from my target message and the message that acted on it. */
function build(target: StoredMessage, m: StoredMessage): Notification {
  const rootId =
    target.type === 'reply' ? (target.content as ReplyContent).root : target.id
  const base = {
    id: m.id,
    actor: m.author,
    ts: m.displayTs,
    rootId,
    targetText: (target.content as { text?: string }).text ?? '',
  }
  if (m.type === 'reaction') {
    return { ...base, kind: 'like', emoji: (m.content as ReactionContent).emoji }
  }
  return { ...base, kind: 'reply', replyText: (m.content as ReplyContent).text }
}

/**
 * My notifications, newest first. A single reverse scan over by-display-ts,
 * keeping only reactions/replies that target one of my own messages — fine at
 * v1 scale (same approach as getTimeline).
 */
export async function getNotifications(
  db: ShabakaDb,
  selfPub: string,
  limit: number,
): Promise<Notification[]> {
  const mine = await getAuthorMessages(db, selfPub)
  const mineById = new Map(mine.map((x) => [x.id, x]))

  const out: Notification[] = []
  let cursor = await db
    .transaction('messages')
    .store.index('by-display-ts')
    .openCursor(null, 'prev')
  while (cursor && out.length < limit) {
    const m = cursor.value
    if (m.author !== selfPub) {
      if (m.type === 'reaction') {
        const target = mineById.get((m.content as ReactionContent).target)
        if (target) out.push(build(target, m))
      } else if (m.type === 'reply') {
        const target = mineById.get((m.content as ReplyContent).parent)
        if (target) out.push(build(target, m))
      }
    }
    cursor = await cursor.continue()
  }
  return out
}

/**
 * Classify a single freshly-ingested message: returns a Notification if it's a
 * like/reply on one of my messages, else null. Used to drive live toasts
 * without rescanning the whole log.
 */
export async function notificationForMessage(
  db: ShabakaDb,
  selfPub: string,
  m: StoredMessage,
): Promise<Notification | null> {
  if (m.author === selfPub) return null
  let targetId: string | undefined
  if (m.type === 'reaction') targetId = (m.content as ReactionContent).target
  else if (m.type === 'reply') targetId = (m.content as ReplyContent).parent
  else return null
  if (!targetId) return null
  const target = await getMessage(db, targetId)
  if (!target || target.author !== selfPub) return null
  return build(target, m)
}
