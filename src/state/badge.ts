import { countUnread, type ReadCursors } from '../core/unread'
import { useApp, withDb, type View } from './store'

/**
 * PWA app-icon badge (and tab-title mirror) for unread notifications.
 *
 * We keep a per-category "read up to" cursor in localStorage. A category is
 * marked read (cursor := now) whenever its view is open and the app is
 * foregrounded; the badge shows the count of everything newer than the cursors.
 * The count is recomputed off store changes (dataVersion bumps on every ingest,
 * local or remote) and on tab visibility changes.
 *
 * setAppBadge only paints on an installed PWA, but it's a safe no-op elsewhere;
 * the tab-title mirror gives the same signal in an ordinary browser tab.
 */

const STORAGE_KEY = 'shabaka-read'

function nowMs(): number {
  return Date.now()
}

function loadCursors(): ReadCursors {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<ReadCursors>
      return {
        feed: Number(p.feed) || 0,
        replies: Number(p.replies) || 0,
        dms: Number(p.dms) || 0,
        likes: Number(p.likes) || 0,
      }
    }
  } catch {
    // fall through to first-run default
  }
  // First run (incl. existing installs adopting this feature): treat all prior
  // history as already seen so we don't badge the entire backlog at once.
  const now = nowMs()
  const fresh: ReadCursors = { feed: now, replies: now, dms: now, likes: now }
  persist(fresh)
  return fresh
}

function persist(c: ReadCursors): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
  } catch {
    // private mode etc. — cursors just won't survive a reload
  }
}

let cursors = loadCursors()

/** Which read cursors a given view clears while it's open. */
function bucketsForView(view: View): (keyof ReadCursors)[] {
  switch (view.name) {
    case 'feed':
      return ['feed']
    case 'thread':
      return ['replies']
    case 'notifications':
      // The notifications page surfaces both likes and replies to my posts.
      return ['likes', 'replies']
    case 'dms':
    case 'dm':
      return ['dms']
    default:
      return []
  }
}

function isForegrounded(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

/** Mark the view's categories read, if the app is actually foregrounded. */
function markReadForView(view: View): void {
  if (!isForegrounded()) return
  const buckets = bucketsForView(view)
  if (buckets.length === 0) return
  const now = nowMs()
  for (const b of buckets) cursors[b] = now
  persist(cursors)
}

let baseTitle = ''

function applyCount(n: number): void {
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (n > 0) void nav.setAppBadge?.(n).catch(() => {})
    else void nav.clearAppBadge?.().catch(() => {})
  } catch {
    // Badging API unavailable — the title mirror still works
  }
  if (typeof document !== 'undefined') {
    if (!baseTitle) baseTitle = document.title || 'Shabaka'
    document.title = n > 0 ? `(${n}) ${baseTitle}` : baseTitle
  }
}

/** Publish the in-app notifications count, but only when it actually changes —
 * writing state unconditionally would re-trigger our own store subscription. */
function setNotifUnread(n: number): void {
  if (useApp.getState().notifUnread !== n) useApp.setState({ notifUnread: n })
}

async function recompute(): Promise<void> {
  const id = useApp.getState().identity
  if (!id) {
    applyCount(0)
    setNotifUnread(0)
    return
  }
  try {
    const counts = await withDb((db) => countUnread(db, id.pub, cursors))
    applyCount(counts.total)
    setNotifUnread(counts.likes + counts.replies)
  } catch {
    // DB not ready / transient failure — leave the current badge as-is
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
function scheduleRecompute(): void {
  if (timer) return
  timer = setTimeout(() => {
    timer = undefined
    void recompute()
  }, 250)
}

let started = false

/** Start tracking unread notifications and reflecting them in the app badge. */
export function startBadge(): void {
  if (started) return
  started = true

  useApp.subscribe((s, prev) => {
    if (s.view !== prev.view) markReadForView(s.view)
    scheduleRecompute()
  })

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (isForegrounded()) markReadForView(useApp.getState().view)
      scheduleRecompute()
    })
  }

  // If we're already looking at a view on load, count it as read up front.
  markReadForView(useApp.getState().view)
  scheduleRecompute()
}
