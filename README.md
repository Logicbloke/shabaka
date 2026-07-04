# Shabaka

A peer-to-peer social network that runs entirely in the browser. No servers,
no accounts, no company. Your identity is an Ed25519 keypair; every message
you publish is signed; peers replicate each other's logs so your posts reach
your followers even while you're offline.

## How it works

- **Identity** — an Ed25519 keypair generated in your browser. The public key
  *is* your user ID. The seed can be exported as a one-line backup string and
  optionally encrypted at rest with a passphrase (scrypt + XChaCha20-Poly1305).
- **Messages** — every post, reply, reaction, profile update, follow, and DM
  is an envelope in your personal append-only log: signed, sequence-numbered,
  and hash-chained to your previous message (the Secure Scuttlebutt model).
  Nobody can forge, alter, reorder, or truncate your log without breaking
  signatures or the hash chain.
- **Storage** — everything lives in IndexedDB in your browser.
- **Transport** — browsers connect directly over WebRTC. Peer discovery uses
  [Trystero](https://github.com/dmotz/trystero) across three independent
  public infrastructures simultaneously — Nostr relays, MQTT brokers, and
  BitTorrent trackers — so there is no single rendezvous point to block.
- **Store-and-forward** — when you follow someone, you replicate their log
  and *offer it to other peers*. If Alice is offline, Bob (her follower)
  relays her signed posts to Carol. Signatures make third-party relay safe.
- **DMs** — encrypted to the recipient (X25519 ECDH + XChaCha20-Poly1305) but
  carried in your public log, so peers relay them without being able to read
  them.

## Quickstart

```sh
bun install
bun run dev        # open http://localhost:5173
```

Open a second browser window in incognito to get a second identity, exchange
public keys via the Follows page, and watch posts sync peer-to-peer.

Env overrides (useful for development):

```sh
VITE_STRATEGIES=mqtt VITE_LOCAL_BROKER=1 bun run dev   # offline: local broker only
```

## Testing

```sh
bun run test   # 54 unit tests: crypto, chain validation, gossip protocol
bun run e2e    # Playwright: 3 browser contexts, incl. offline-relay scenario
```

The e2e suite runs fully offline against a local MQTT broker started by
`e2e/global-setup.ts` — no public infrastructure involved.

## Threat model — read this if your safety depends on it

What Shabaka defends against:

- **Content forgery/tampering** — every message is Ed25519-signed and
  hash-chained; relaying peers cannot alter anything undetected. An author
  who signs two conflicting histories (equivocation) is detected and flagged.
- **Infrastructure takedown** — no servers to seize. Discovery works if *any
  one* of many public Nostr relays / MQTT brokers / BitTorrent trackers is
  reachable; the app is a static file that can be mirrored anywhere.
- **DM confidentiality (content only)** — relaying peers carry ciphertext
  they cannot read.

What Shabaka does **not** defend against:

- **IP exposure.** WebRTC reveals your IP address to every peer you connect
  to, and it does not work in Tor Browser. This is the single biggest
  limitation for high-risk users. A trusted VPN mitigates it.
- **Membership metadata.** Public relays/brokers/trackers can observe that
  some client joined the Shabaka room, and when.
- **Permanence.** All non-DM content is public and replicated forever; there
  is no delete.
- **DM metadata.** Who you DM, when, and roughly how much is public — only
  the content is encrypted. There is no forward secrecy: a stolen key
  decrypts all past DMs.
- **Endpoint compromise.** The key lives in your browser. Malware, a
  malicious extension, or an XSS hole can steal it. Mitigations: strict CSP,
  all user content rendered as text, passphrase encryption at rest.
- **Sybil/spam.** Anyone can generate keys. The UI only shows authors you
  follow, which is the v1 spam defense.

## Architecture

```
src/core/       framework-agnostic protocol code (no React)
  canonical.ts  canonical JSON for signing (sorted keys, ints/strings/null only)
  envelope.ts   sign / verify / hash message envelopes
  validate.ts   receive pipeline: schema → dedupe → signature → hash chain
  logstore.ts   atomic ingest + derived state (heads, follows, profiles)
  sync.ts       gossip: hello(interest) → have(heads) → want(ranges) → msgs
  net.ts        multi-strategy Trystero adapter
  db.ts         IndexedDB schema (idb)
  identity.ts   keygen, backup, passphrase encryption at rest
  dm.ts         X25519 + XChaCha20-Poly1305 sealed DMs
state/          zustand store + network glue (the only core↔UI bridge)
ui/             React components
tests/          vitest unit tests (run in Node via fake-indexeddb)
e2e/            Playwright multi-context tests + local MQTT broker
```

Wire protocol: on connect, peers exchange `hello` (session nonce + interest
set = self + followed authors), then `have` vectors (latest seq per offered
author), request missing ranges with `want`, and stream `msgs` in batches.
New messages are eagerly pushed to interested peers; a 60-second anti-entropy
cycle re-exchanges `have` vectors. Each peer offers its own log plus the logs
of everyone it follows — that rule is what makes offline relay work.
