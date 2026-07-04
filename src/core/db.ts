import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb'
import type {
  FollowRecord,
  Head,
  IdentityRecord,
  PendingRecord,
  ProfileRecord,
  StoredMessage,
} from './types'

export interface ShabakaSchema extends DBSchema {
  messages: {
    key: string
    value: StoredMessage
    indexes: {
      'by-author-seq': [string, number]
      'by-display-ts': number
      'by-author-type': [string, string]
      'by-root': string
      'by-target': string
    }
  }
  heads: { key: string; value: Head }
  follows: {
    key: [string, string]
    value: FollowRecord
    indexes: { 'by-follower': string }
  }
  profiles: { key: string; value: ProfileRecord }
  identity: { key: string; value: IdentityRecord }
  pending: {
    key: string
    value: PendingRecord
    indexes: { 'by-author-seq': [string, number]; 'by-received': number }
  }
}

export type ShabakaDb = IDBPDatabase<ShabakaSchema>
export type IngestTx = IDBPTransaction<
  ShabakaSchema,
  ('messages' | 'heads' | 'follows' | 'profiles')[],
  'readwrite'
>

export const PENDING_CAP = 500

export function openShabakaDb(name = 'shabaka'): Promise<ShabakaDb> {
  return openDB<ShabakaSchema>(name, 1, {
    upgrade(db) {
      const messages = db.createObjectStore('messages', { keyPath: 'id' })
      messages.createIndex('by-author-seq', ['author', 'seq'], { unique: true })
      messages.createIndex('by-display-ts', 'displayTs')
      messages.createIndex('by-author-type', ['author', 'type'])
      messages.createIndex('by-root', 'root')
      messages.createIndex('by-target', 'target')

      db.createObjectStore('heads', { keyPath: 'author' })

      const follows = db.createObjectStore('follows', {
        keyPath: ['follower', 'target'],
      })
      follows.createIndex('by-follower', 'follower')

      db.createObjectStore('profiles', { keyPath: 'author' })
      db.createObjectStore('identity', { keyPath: 'id' })

      const pending = db.createObjectStore('pending', { keyPath: 'id' })
      pending.createIndex('by-author-seq', ['author', 'seq'])
      pending.createIndex('by-received', 'receivedAt')
    },
  })
}

export function getHead(db: ShabakaDb, author: string): Promise<Head | undefined> {
  return db.get('heads', author)
}

export function getAllHeads(db: ShabakaDb): Promise<Head[]> {
  return db.getAll('heads')
}

export function getMessage(db: ShabakaDb, id: string): Promise<StoredMessage | undefined> {
  return db.get('messages', id)
}

export function getByAuthorRange(
  db: ShabakaDb,
  author: string,
  fromSeq: number,
  toSeq: number,
): Promise<StoredMessage[]> {
  return db.getAllFromIndex(
    'messages',
    'by-author-seq',
    IDBKeyRange.bound([author, fromSeq], [author, toSeq]),
  )
}

export function getAuthorMessages(
  db: ShabakaDb,
  author: string,
  limit?: number,
): Promise<StoredMessage[]> {
  return db.getAllFromIndex(
    'messages',
    'by-author-seq',
    IDBKeyRange.bound([author, 1], [author, Infinity]),
    limit,
  )
}

export function getThread(db: ShabakaDb, rootId: string): Promise<StoredMessage[]> {
  return db.getAllFromIndex('messages', 'by-root', rootId)
}

export function getReactions(db: ShabakaDb, targetId: string): Promise<StoredMessage[]> {
  return db.getAllFromIndex('messages', 'by-target', targetId)
}

/**
 * Timeline of the given authors, newest first, paged with `before` (displayTs
 * upper bound, exclusive). Cursor over by-display-ts with an in-memory author
 * filter — fine at v1 scale.
 */
export async function getTimeline(
  db: ShabakaDb,
  authors: Set<string>,
  before: number,
  limit: number,
): Promise<StoredMessage[]> {
  const out: StoredMessage[] = []
  const range = IDBKeyRange.upperBound(before, true)
  let cursor = await db
    .transaction('messages')
    .store.index('by-display-ts')
    .openCursor(range, 'prev')
  while (cursor && out.length < limit) {
    const m = cursor.value
    if (authors.has(m.author) && (m.type === 'post' || m.type === 'reply')) {
      out.push(m)
    }
    cursor = await cursor.continue()
  }
  return out
}

export function getFollows(db: ShabakaDb, follower: string): Promise<FollowRecord[]> {
  return db.getAllFromIndex('follows', 'by-follower', follower)
}

export function getProfile(db: ShabakaDb, author: string): Promise<ProfileRecord | undefined> {
  return db.get('profiles', author)
}

export function getAllProfiles(db: ShabakaDb): Promise<ProfileRecord[]> {
  return db.getAll('profiles')
}

export function getIdentityRecord(db: ShabakaDb): Promise<IdentityRecord | undefined> {
  return db.get('identity', 'self')
}

export function putIdentityRecord(db: ShabakaDb, record: IdentityRecord): Promise<string> {
  return db.put('identity', record)
}

export function getPendingByAuthorSeq(
  db: ShabakaDb,
  author: string,
  seq: number,
): Promise<PendingRecord | undefined> {
  return db.getFromIndex('pending', 'by-author-seq', [author, seq])
}

/** Insert into the pending buffer, evicting oldest entries past the cap. */
export async function putPending(db: ShabakaDb, record: PendingRecord): Promise<void> {
  const tx = db.transaction('pending', 'readwrite')
  await tx.store.put(record)
  let count = await tx.store.count()
  if (count > PENDING_CAP) {
    let cursor = await tx.store.index('by-received').openCursor()
    while (cursor && count > PENDING_CAP) {
      await cursor.delete()
      count--
      cursor = await cursor.continue()
    }
  }
  await tx.done
}

export function deletePending(db: ShabakaDb, id: string): Promise<void> {
  return db.delete('pending', id)
}

export async function getDmMessages(db: ShabakaDb, selfPub: string): Promise<StoredMessage[]> {
  const [received, sentIndex] = await Promise.all([
    db.getAllFromIndex('messages', 'by-target', selfPub),
    db.getAllFromIndex('messages', 'by-author-type', [selfPub, 'dm']),
  ])
  return [...received.filter((m) => m.type === 'dm'), ...sentIndex]
}
