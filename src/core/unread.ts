import { getAuthorMessages, getFollows, type ShabakaDb } from './db'
import type { ReactionContent, ReplyContent } from './types'

/**
 * Per-category "everything up to this displayTs is read" cursors. Persisted by
 * the state layer (state/badge.ts); the core just counts against them.
 */
export interface ReadCursors {
  /** posts + replies from followed authors */
  feed: number
  /** replies to my own posts/replies */
  replies: number
  /** DMs addressed to me */
  dms: number
  /** reactions to my own posts/replies */
  likes: number
}

export const ZERO_CURSORS: ReadCursors = { feed: 0, replies: 0, dms: 0, likes: 0 }

export interface UnreadCounts extends ReadCursors {
  total: number
}

/**
 * Count unread notifications across three mutually-exclusive buckets, without
 * decrypting anything (DM ciphertext is opaque; we count by envelope metadata):
 *
 *  - dms:     DMs addressed to me by someone else
 *  - replies: replies to one of my own messages (from anyone but me)
 *  - likes:   reactions to one of my own messages (from anyone but me)
 *  - feed:    posts/replies from followed authors that aren't replies to me
 *
 * A single reverse scan over the by-display-ts index bounded below by the
 * earliest cursor — so we only ever visit the unread window, not the whole log.
 */
export async function countUnread(
  db: ShabakaDb,
  selfPub: string,
  cursors: ReadCursors,
): Promise<UnreadCounts> {
  const [followRecords, mine] = await Promise.all([
    getFollows(db, selfPub),
    getAuthorMessages(db, selfPub),
  ])
  const follows = new Set(followRecords.filter((f) => f.following).map((f) => f.target))
  const mineIds = new Set(mine.map((m) => m.id))

  const floor = Math.min(cursors.feed, cursors.replies, cursors.dms, cursors.likes)
  let feed = 0
  let replies = 0
  let dms = 0
  let likes = 0
  // A forked log or misbehaving client can emit the same reaction twice; count
  // one per (actor, post, emoji) so a double "like" doesn't inflate the badge.
  const seenLikes = new Set<string>()

  let cursor = await db
    .transaction('messages')
    .store.index('by-display-ts')
    .openCursor(IDBKeyRange.lowerBound(floor, true), 'prev')
  while (cursor) {
    const m = cursor.value
    if (m.author !== selfPub) {
      if (m.type === 'dm') {
        if (m.target === selfPub && m.displayTs > cursors.dms) dms++
      } else if (m.type === 'reply' && mineIds.has((m.content as ReplyContent).parent)) {
        if (m.displayTs > cursors.replies) replies++
      } else if (m.type === 'reaction' && mineIds.has(m.target ?? '')) {
        const likeKey = m.author + '\t' + m.target + '\t' + (m.content as ReactionContent).emoji
        if (m.displayTs > cursors.likes && !seenLikes.has(likeKey)) {
          seenLikes.add(likeKey)
          likes++
        }
      } else if ((m.type === 'post' || m.type === 'reply') && follows.has(m.author)) {
        if (m.displayTs > cursors.feed) feed++
      }
    }
    cursor = await cursor.continue()
  }

  return { feed, replies, dms, likes, total: feed + replies + dms + likes }
}
