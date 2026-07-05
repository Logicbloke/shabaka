/**
 * Strip characters that let attacker-authored text visually reorder or
 * overwrite neighboring UI: C0/C1 controls (newline and tab stay) and the
 * Unicode bidi embedding/override/isolate controls. Legitimate mixed-direction
 * text never needs the explicit controls here — every user-content element
 * renders with dir="auto", which isolates it and picks the direction itself.
 * Render-time only: stored envelopes are signed and must not be rewritten.
 */
const STRIP_RE = new RegExp(
  '[\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F\\u202A-\\u202E\\u2066-\\u2069]',
  'g',
)

export function cleanText(s: string): string {
  return s.replace(STRIP_RE, '')
}
