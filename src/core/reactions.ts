import type { ReactionContent, StoredMessage } from './types'

/**
 * Collapse a post's reactions so each author counts at most once per emoji.
 *
 * The same identity can legitimately emit two reaction envelopes for one post —
 * it posted from two installs (a forked log; see resetAuthorLog), or a
 * non-standard client double-fired — and counting both would inflate the tally
 * ("someone liked twice"). Reactions are append-only and signed, so we can't
 * remove the duplicates from the log; we dedupe when we read them. The first
 * envelope seen for each (author, emoji) pair wins.
 */
export function dedupeReactions(reactions: StoredMessage[]): StoredMessage[] {
  const seen = new Set<string>()
  const out: StoredMessage[] = []
  for (const r of reactions) {
    const key = r.author + '\t' + (r.content as ReactionContent).emoji
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}
