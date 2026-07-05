# شبكة | Shabaka

<div dir="rtl">

## بالعربية

**شبكة** هي شبكة اجتماعية من نظير إلى نظير تعمل بالكامل داخل المتصفح. لا خوادم، لا حسابات، لا شركة. هويتك مفتاح تشفير يولَّد في متصفحك؛ كل رسالة تنشرها موقَّعة رقميًا؛ والأقران يتناقلون سجلات بعضهم البعض، فتصل منشوراتك إلى متابعيك حتى وأنت غير متصل. حجب موقع أو خادم واحد لا يوقف الشبكة — التطبيق نفسه ملف ثابت يمكن لأي شخص نسخه واستضافته في أي مكان.

### طرق التشغيل

لا تحتاج إلى git ولا Node ولا أي أدوات برمجية — يكفي متصفح حديث (كروم أو فايرفوكس):

1. **من الرابط مباشرة (الأسهل):**
افتح <https://logicbloke.github.io/shabaka/>
ويمكنك تثبيته على هاتفك كتطبيق: اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت» من قائمة المتصفح، وسيفتح بعدها حتى دون اتصال بالإنترنت.

2. **ملف واحد تفتحه بنقرة مزدوجة:**
حمّل [`shabaka.html`](https://github.com/Logicbloke/shabaka/releases/latest/download/shabaka.html) من صفحة الإصدارات، ثم افتحه في متصفحك بنقرة مزدوجة. التطبيق كامل داخل ملف واحد، ويمكن نقله على وصلة USB ومشاركته دون إنترنت.

3. **خادم ملفات محلي:**
حمّل [`shabaka-static.zip`](https://github.com/Logicbloke/shabaka/releases/latest/download/shabaka-static.zip)، فك الضغط، ثم شغّل داخل المجلد أي خادم ملفات ثابتة، مثلًا:
`python3 -m http.server 8080`
وافتح <http://localhost:8080>

4. **للمطورين (من المصدر):**
يتطلب [Bun](https://bun.sh) — ثم:
`git clone git@github.com:Logicbloke/shabaka.git && cd shabaka && bun install && bun run dev`

### تحديث النسخة

يعرض التطبيق تلقائيًا شريطًا عند صدور إصدار جديد (يستعلم عن آخر إصدار من GitHub؛ إن حُجب ذلك يعمل التطبيق كما هو). التحديث نفسه يدويّ حسب طريقة التشغيل:

1. **من الرابط:** يتحدّث تلقائيًا عند إعادة فتحه وأنت متصل — لا شيء عليك فعله.
2. **ملف واحد:** أعد تنزيل [`shabaka.html`](https://github.com/Logicbloke/shabaka/releases/latest/download/shabaka.html) واستبدل الملف القديم.
3. **خادم ملفات محلي:** أعد تنزيل [`shabaka-static.zip`](https://github.com/Logicbloke/shabaka/releases/latest/download/shabaka-static.zip)، وفكّ ضغطه فوق المجلد المستضاف؛ يمسح عامل الخدمة الذاكرة المؤقتة القديمة عند التحميل التالي.
4. **من المصدر:** `git pull && bun run build`.

### تحذير أمني مهم

اقرأ هذا إن كانت سلامتك تعتمد عليه:

- **عنوان IP الخاص بك مرئي لكل قرين تتصل به.** تقنية WebRTC تصل المتصفحات مباشرة ولا تعمل عبر متصفح Tor. استخدم VPN تثق به إن كان هذا يهمّك.
- كل المحتوى غير الخاص (المنشورات، المتابعات، التفاعلات) **علني ودائم** — لا يوجد حذف.
- الرسائل الخاصة مشفّرة، لكن بياناتها الوصفية (مع من، متى، كم) علنية، ولا سرّية أمامية لها.
- مفتاحك يعيش في متصفحك؛ البرمجيات الخبيثة قادرة على سرقته. فعّل عبارة المرور عند الإعداد.

التفاصيل الكاملة في صفحة «الأمان» داخل التطبيق.

</div>

---

## English

A peer-to-peer social network that runs entirely in the browser. No servers,
no accounts, no company. Your identity is an Ed25519 keypair; every message
you publish is signed; peers replicate each other's logs so your posts reach
your followers even while you're offline. Blocking any one site or server
does not stop the network — the app itself is a static file anyone can copy
and host anywhere.

### Ways to run it

End users need **no git, no Node, no tooling** — just a modern browser
(Chrome or Firefox):

1. **Hosted (easiest):** open <https://logicbloke.github.io/shabaka/>.
   It is a PWA — on a phone, pick "Add to Home Screen" / "Install" from the
   browser menu to use it as an app; once installed it opens offline too.

2. **Single file, double-click:** download
   [`shabaka.html`](https://github.com/Logicbloke/shabaka/releases/latest/download/shabaka.html)
   from the Releases page and open it in your browser. The whole app is one
   file — it can travel on a USB stick and be shared without internet.

3. **Local static server:** download
   [`shabaka-static.zip`](https://github.com/Logicbloke/shabaka/releases/latest/download/shabaka-static.zip),
   unzip, and serve the folder with any static file server, e.g.
   `python3 -m http.server 8080`, then open <http://localhost:8080>.

4. **From source (developers):** requires [Bun](https://bun.sh):

   ```sh
   git clone git@github.com:Logicbloke/shabaka.git
   cd shabaka && bun install
   bun run dev        # open http://localhost:5173
   ```

However you run it, all instances join the same network: discovery happens
over public Nostr relays, MQTT brokers, and BitTorrent trackers
([Trystero](https://github.com/dmotz/trystero)), then peers connect directly
over WebRTC.

### Keeping it up to date

The app shows a banner when a newer release exists (it checks GitHub's latest
release; if that request is blocked the app is unaffected). Applying the update
is manual and depends on how you run it:

1. **Hosted:** updates itself on the next online load — nothing to do.
2. **Single file:** re-download
   [`shabaka.html`](https://github.com/Logicbloke/shabaka/releases/latest/download/shabaka.html)
   and replace the old file.
3. **Local static server:** re-download
   [`shabaka-static.zip`](https://github.com/Logicbloke/shabaka/releases/latest/download/shabaka-static.zip)
   and unzip it over the served folder; the service worker evicts the old cache
   on the next load.
4. **From source:** `git pull && bun run build`.

### How it works

- **Identity** — an Ed25519 keypair generated in your browser. The public key
  *is* your user ID. The seed can be exported as a one-line backup string and
  optionally encrypted at rest with a passphrase (scrypt + XChaCha20-Poly1305).
- **Messages** — every post, reply, reaction, profile update, follow, and DM
  is an envelope in your personal append-only log: signed, sequence-numbered,
  and hash-chained to your previous message (the Secure Scuttlebutt model).
  Nobody can forge, alter, reorder, or truncate your log without breaking
  signatures or the hash chain.
- **Storage** — everything lives in IndexedDB in your browser.
- **Store-and-forward** — when you follow someone, you replicate their log
  and *offer it to other peers*. If Alice is offline, Bob (her follower)
  relays her signed posts to Carol. Signatures make third-party relay safe.
- **DMs** — encrypted to the recipient (X25519 ECDH + XChaCha20-Poly1305) but
  carried in your public log, so peers relay them without being able to read
  them.
- **Languages** — full Arabic (RTL) and English UI; posts in either direction
  render correctly regardless of UI language.

### Testing

```sh
bun run test   # unit tests: crypto, chain validation, gossip protocol
bun run e2e    # Playwright: 3 browser contexts, incl. offline-relay scenario
```

The e2e suite runs fully offline against a local MQTT broker started by
`e2e/global-setup.ts` — no public infrastructure involved.

### Threat model — read this if your safety depends on it

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
- **Update-check metadata.** To flag new releases, non-hosted builds
  periodically contact `api.github.com`, revealing your IP to GitHub. It is
  best-effort — block it and the app is unaffected.

### Architecture

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
ui/             React components + i18n (en/ar)
tests/          vitest unit tests (run in Node via fake-indexeddb)
e2e/            Playwright multi-context tests + local MQTT broker
```

Wire protocol: on connect, peers exchange `hello` (session nonce + interest
set = self + followed authors), then `have` vectors (latest seq per offered
author), request missing ranges with `want`, and stream `msgs` in batches.
New messages are eagerly pushed to interested peers; a 60-second anti-entropy
cycle re-exchanges `have` vectors. Each peer offers its own log plus the logs
of everyone it follows — that rule is what makes offline relay work.
