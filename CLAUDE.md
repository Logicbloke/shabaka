# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Shabaka (شبكة) is a serverless peer-to-peer social network that runs entirely in the browser. Identity is an Ed25519 keypair; every message is a signed, hash-chained envelope in a per-author append-only log (Secure Scuttlebutt model); peers discover each other via Trystero (Nostr relays / MQTT brokers / BitTorrent trackers) and sync directly over WebRTC. Storage is IndexedDB. UI is bilingual English/Arabic (RTL).

## Commands

Uses **Bun** (not npm/node):

```sh
bun install
bun run dev                    # Vite dev server on :5173
bun run build                  # tsc --noEmit + vite build → dist/
bun run build:single           # SINGLE_FILE=1 build → dist-single/shabaka.html (self-contained, runs from file://)
bun run test                   # vitest unit tests (Node + fake-indexeddb)
bun run test tests/sync.test.ts        # single test file
bun run test:watch
bun run e2e                    # Playwright multi-context tests (starts dev server itself)
bun run e2e e2e/dm.spec.ts             # single e2e spec
bun scripts/check-singlefile.ts        # smoke-test dist-single/shabaka.html via Playwright (run after build:single; hardcodes an absolute path)
bun scripts/gen-icons.ts               # regenerate public/icons/ PNGs from the inline SVG (only when the icon design changes)
```

There is no lint script; `tsc --noEmit` (part of `bun run build`) is the type gate. tsconfig is strict with `noUnusedLocals`/`noUnusedParameters`.

The e2e suite runs fully offline and deterministic: `e2e/global-setup.ts` starts a local MQTT-over-WebSocket broker (aedes bridged to `Bun.serve`) on port 9001, and `playwright.config.ts` sets `VITE_STRATEGIES=mqtt` + `VITE_LOCAL_BROKER=1`. It runs with `workers: 1`, not parallel.

## Architecture

Strict layering — `src/core/` is framework-agnostic protocol code with **no React imports**; `src/state/` is the only bridge between core and UI; `src/ui/` is React.

```
src/core/
  canonical.ts  canonical JSON for signing (sorted keys; ints/strings/null only)
  envelope.ts   sign / verify / hash message envelopes
  validate.ts   receive pipeline: schema → dedupe → signature → hash chain
  logstore.ts   atomic ingest + derived state (heads, follows, profiles)
  sync.ts       gossip protocol: hello(interest) → have(heads) → want(ranges) → msgs
  net.ts        multi-strategy Trystero adapter (NetworkManager)
  db.ts         IndexedDB schema (idb)
  identity.ts   keygen, backup string, passphrase encryption at rest (scrypt + XChaCha20-Poly1305)
  dm.ts         X25519 ECDH + XChaCha20-Poly1305 sealed DMs (carried in the public log)
  events.ts     coreEvents emitter — how core notifies state/UI
src/state/
  store.ts      zustand store
  network.ts    startNetwork(): wires NetworkManager ↔ SyncManager ↔ coreEvents; started once identity unlocks
src/ui/         React components + i18n.ts (en/ar)
tests/          vitest unit tests; helpers.ts has testDb() and makeChain() for building signed envelope chains
e2e/            Playwright multi-browser-context tests (sync, relay, DM scenarios)
```

Wire protocol: on connect peers exchange `hello` (session nonce + interest set = self + followed authors), then `have` vectors (latest seq per offered author), request missing ranges with `want`, stream `msgs` in batches. New local messages are eagerly pushed (`coreEvents` `local-append` → `sync.push`); a 60-second anti-entropy cycle re-exchanges `have`. Each peer offers its own log **plus the logs of everyone it follows** — that rule is what makes offline store-and-forward relay work. Duplicate connections across discovery strategies are deduped at the sync layer via session nonces and msgId.

Env overrides (used by tests, useful for local debugging): `VITE_STRATEGIES=mqtt` limits discovery strategies; `VITE_LOCAL_BROKER=1` points mqtt at `ws://localhost:9001`.

## Invariants to respect

- Logs are append-only, signed, and hash-chained. Never mutate or reorder stored envelopes; validation (`validate.ts`) rejects anything that breaks signatures, sequence numbers, or the chain. Equivocation (two conflicting histories from one author) is detected and flagged.
- `canonical.ts` defines the byte-exact signing format — changing it breaks every existing signature on the network. Envelope/wire changes are protocol changes; the app id is `shabaka-v1` (net.ts).
- Security posture matters here (see README threat model): strict CSP is injected into production builds (vite.config.ts), all user content is rendered as text (XSS steals keys), and all non-DM content is public and permanent. DM content is encrypted but DM metadata is public; no forward secrecy.
- Each discovery strategy failing is non-fatal by design — never make one relay/broker/tracker load-bearing.
- Both build outputs matter: `dist/` (hosted, strict CSP) and `dist-single/shabaka.html` (single file, must keep working from `file://` — verify with `scripts/check-singlefile.ts`).
- The hosted build is an installable offline-capable PWA: vite.config.ts generates `sw.js` at build time (precache list from the bundle; new files in `public/` must be added to `PUBLIC_PRECACHE` there). The single-file build strips all PWA tags (`<!-- pwa:start/end -->` markers in index.html) — service workers don't exist on `file://`.
- UI must work in both LTR (en) and RTL (ar); strings live in `src/ui/i18n.ts`.
