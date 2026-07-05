import { useApp, type Lang } from '../state/store'

/**
 * All UI strings. `en` is the source of truth for the key set; `ar` must
 * cover every key (enforced by tests/i18n.test.ts). No i18n library — a
 * dictionary and a lookup are all this app needs.
 */
export const en = {
  brand: 'Shabaka',

  navFeed: 'Feed',
  navFollows: 'Follows',
  navDms: 'DMs',
  navMe: 'Me',
  navSecurity: 'Security',

  peersLocalOnly: 'local only',
  peersOne: '1 peer',
  peersMany: '{n} peers',

  obLoading: 'Loading…',
  obIntro:
    'A peer-to-peer social network. Your identity is a cryptographic key that lives only in this browser — there is no server and no account recovery.',
  obCreate: 'Create a new identity',
  obImportExisting: 'Import an existing key',
  obBackupTitle: 'Write down your key backup',
  obBackupWarn:
    'This is the only way to recover your identity. Anyone who has it is you. Store it somewhere safe, off this device.',
  obSavedContinue: 'I saved it — continue',
  obEncryptTitle: 'Encrypt your key at rest?',
  obEncryptWarn:
    'A passphrase encrypts the key stored in this browser, protecting it if the device is stolen or the browser data is copied. Strongly recommended.',
  obPassOptionalPlaceholder: 'Passphrase (leave empty to skip)',
  obEncryptStart: 'Encrypt and start',
  obSkipStart: 'Skip and start',
  obSettingUp: 'Setting up…',
  obLockedMsg: 'Your identity key is encrypted. Enter your passphrase.',
  obPassphrase: 'Passphrase',
  obUnlock: 'Unlock',
  obUnlocking: 'Unlocking…',
  obImportTitle: 'Import your key',
  obImportPassPlaceholder: 'New passphrase for this device (optional)',
  obImport: 'Import',
  obImporting: 'Importing…',
  obBack: 'Back',

  feedEmpty: 'Nothing here yet. Post something, or follow someone from the Follows page.',
  loadMore: 'Load more',

  composePlaceholder: "What's happening?",
  replyPlaceholder: 'Write a reply…',
  post: 'Post',
  reply: 'Reply',
  msgRejected: 'Message could not be published — it is probably too long.',

  inThread: 'in thread',
  alreadyReacted: 'already reacted',
  react: 'react',

  loading: 'Loading…',
  threadNotSynced: 'Post not yet synced to this device.',

  editProfile: 'Edit profile',
  displayName: 'Display name',
  bio: 'Bio',
  save: 'Save',
  forkWarning:
    '⚠ This identity has published conflicting message histories (possible key compromise or tampering). Its log no longer replicates cleanly.',
  copyKey: 'copy key',
  copied: 'copied!',
  follow: 'Follow',
  unfollow: 'Unfollow',
  messagesTotal: 'Messages ({n} total)',

  followingTitle: 'Following',
  followsHint:
    'There is no global directory — exchange public keys out-of-band (in person, over another secure channel). Your key is on the “{me}” page.',
  followPlaceholder: 'Paste a public key to follow',
  badKey: 'That does not look like a Shabaka public key (43 base64url characters).',
  ownKey: 'That is your own key.',
  notFollowing: 'Not following anyone yet.',

  dmsTitle: 'Direct messages',
  dmStartPlaceholder: 'Start a conversation: paste a public key',
  open: 'Open',
  noConversations: 'No conversations yet.',
  dmHint:
    'End-to-end encrypted. Relaying peers see who and when, never what. No forward secrecy — see the Security page.',
  cantDecrypt: '⚠ could not decrypt',
  dmPlaceholder: 'Encrypted message…',
  send: 'Send',

  secTitle: 'Security & threat model',
  secBackupTitle: 'Key backup',
  secReveal: 'Reveal key backup',
  secProtectsTitle: 'What Shabaka protects',
  secP1:
    "Every message is signed with the author's key. Nobody — including relaying peers — can forge or alter a message without detection.",
  secP2:
    'Direct messages are end-to-end encrypted. Peers relay them without being able to read them.',
  secP3:
    'There is no server. Discovery uses many independent public infrastructures (Nostr relays, MQTT brokers, BitTorrent trackers); blocking one does not stop the network.',
  secNotTitle: 'What Shabaka does NOT protect — read this if your safety depends on it',
  secN1:
    'Your IP address is visible to every peer you connect to. WebRTC connects browsers directly, and it does not work through Tor Browser. A hostile peer in the network can learn your IP. Use a VPN you trust if this matters.',
  secN2:
    'Public discovery infrastructure can observe that your client joined the Shabaka network, and roughly when.',
  secN3:
    'All non-DM content — posts, profiles, follows, reactions — is public and permanent. There is no delete; other peers keep replicating what you published.',
  secN4:
    'DM metadata is public: who you message, when, and approximately how much. Only the content is encrypted. DMs have no forward secrecy: whoever obtains your key can read all your past DMs.',
  secN5:
    'Your key lives in this browser. Malware or a malicious browser extension can steal it. A passphrase protects the key at rest, not while the app is open.',

  errWrongPassphrase: 'Wrong passphrase.',
  errPassphraseRequired: 'A passphrase is required.',
  errNotBackup: 'That is not a Shabaka key backup.',
  errBadSeed: 'Malformed key backup.',
} as const

export type TKey = keyof typeof en

export const ar: Record<TKey, string> = {
  brand: 'شبكة',

  navFeed: 'الخط الزمني',
  navFollows: 'المتابَعون',
  navDms: 'الرسائل',
  navMe: 'أنا',
  navSecurity: 'الأمان',

  peersLocalOnly: 'غير متصل',
  peersOne: 'قرين واحد',
  peersMany: 'الأقران: {n}',

  obLoading: 'جارٍ التحميل…',
  obIntro:
    'شبكة اجتماعية من نظير إلى نظير. هويتك مفتاح تشفير يعيش في هذا المتصفح فقط — لا يوجد خادم ولا استعادة للحساب.',
  obCreate: 'إنشاء هوية جديدة',
  obImportExisting: 'استيراد مفتاح موجود',
  obBackupTitle: 'دوِّن النسخة الاحتياطية لمفتاحك',
  obBackupWarn:
    'هذه هي الطريقة الوحيدة لاستعادة هويتك. من يملك هذا المفتاح يصبح أنت. احفظه في مكان آمن خارج هذا الجهاز.',
  obSavedContinue: 'حفظته — متابعة',
  obEncryptTitle: 'تشفير مفتاحك أثناء التخزين؟',
  obEncryptWarn:
    'عبارة المرور تشفّر المفتاح المخزّن في هذا المتصفح وتحميه إذا سُرق الجهاز أو نُسخت بيانات المتصفح. ننصح بها بشدة.',
  obPassOptionalPlaceholder: 'عبارة المرور (اتركها فارغة للتخطي)',
  obEncryptStart: 'تشفير وبدء',
  obSkipStart: 'تخطٍّ وبدء',
  obSettingUp: 'جارٍ الإعداد…',
  obLockedMsg: 'مفتاح هويتك مشفّر. أدخل عبارة المرور.',
  obPassphrase: 'عبارة المرور',
  obUnlock: 'فتح',
  obUnlocking: 'جارٍ الفتح…',
  obImportTitle: 'استيراد مفتاحك',
  obImportPassPlaceholder: 'عبارة مرور جديدة لهذا الجهاز (اختياري)',
  obImport: 'استيراد',
  obImporting: 'جارٍ الاستيراد…',
  obBack: 'رجوع',

  feedEmpty: 'لا يوجد شيء هنا بعد. انشر شيئًا أو تابع أحدًا من صفحة المتابَعين.',
  loadMore: 'تحميل المزيد',

  composePlaceholder: 'ماذا يحدث؟',
  replyPlaceholder: 'اكتب ردًا…',
  post: 'نشر',
  reply: 'رد',
  msgRejected: 'تعذّر نشر الرسالة — على الأرجح لأنها طويلة جدًا.',

  inThread: 'ضمن نقاش',
  alreadyReacted: 'تفاعلت بالفعل',
  react: 'تفاعل',

  loading: 'جارٍ التحميل…',
  threadNotSynced: 'لم يصل هذا المنشور إلى هذا الجهاز بعد.',

  editProfile: 'تعديل الملف الشخصي',
  displayName: 'الاسم المعروض',
  bio: 'نبذة',
  save: 'حفظ',
  forkWarning:
    '⚠ نشرت هذه الهوية سجلَّي رسائل متعارضين (احتمال اختراق المفتاح أو تلاعب). لن يتزامن سجلها بشكل سليم بعد الآن.',
  copyKey: 'نسخ المفتاح',
  copied: 'نُسخ!',
  follow: 'متابعة',
  unfollow: 'إلغاء المتابعة',
  messagesTotal: 'الرسائل (المجموع {n})',

  followingTitle: 'المتابَعون',
  followsHint:
    'لا يوجد دليل عام — تبادل المفاتيح العامة خارج الشبكة (شخصيًا أو عبر قناة آمنة أخرى). مفتاحك في صفحة «{me}».',
  followPlaceholder: 'الصق مفتاحًا عامًا لمتابعته',
  badKey: 'لا يبدو هذا مفتاحًا عامًا لتطبيق شبكة (43 حرفًا بترميز base64url).',
  ownKey: 'هذا مفتاحك أنت.',
  notFollowing: 'لا تتابع أحدًا بعد.',

  dmsTitle: 'الرسائل الخاصة',
  dmStartPlaceholder: 'ابدأ محادثة: الصق مفتاحًا عامًا',
  open: 'فتح',
  noConversations: 'لا محادثات بعد.',
  dmHint:
    'مشفّرة من طرف إلى طرف. الأقران الناقلون يرون مَن ومتى، لا المحتوى أبدًا. لا سرّية أمامية — راجع صفحة الأمان.',
  cantDecrypt: '⚠ تعذّر فك التشفير',
  dmPlaceholder: 'رسالة مشفّرة…',
  send: 'إرسال',

  secTitle: 'الأمان ونموذج التهديد',
  secBackupTitle: 'النسخة الاحتياطية للمفتاح',
  secReveal: 'إظهار النسخة الاحتياطية للمفتاح',
  secProtectsTitle: 'ما الذي تحميه «شبكة»',
  secP1:
    'كل رسالة موقَّعة بمفتاح صاحبها. لا أحد — بما في ذلك الأقران الناقلون — يستطيع تزوير رسالة أو تعديلها دون انكشاف ذلك.',
  secP2: 'الرسائل الخاصة مشفّرة من طرف إلى طرف. ينقلها الأقران دون أن يتمكنوا من قراءتها.',
  secP3:
    'لا يوجد خادم. يعتمد الاكتشاف على بنى تحتية عامة مستقلة عديدة (مرحّلات Nostr، ووسطاء MQTT، ومتتبّعات BitTorrent)؛ حجب إحداها لا يوقف الشبكة.',
  secNotTitle: 'ما الذي لا تحميه «شبكة» — اقرأ هذا إن كانت سلامتك تعتمد عليه',
  secN1:
    'عنوان IP الخاص بك مرئي لكل قرين تتصل به. تقنية WebRTC تصل المتصفحات مباشرة، ولا تعمل عبر متصفح Tor. قرين معادٍ في الشبكة يمكنه معرفة عنوانك. استخدم VPN تثق به إن كان هذا يهمّك.',
  secN2: 'البنية التحتية العامة للاكتشاف يمكنها ملاحظة أن عميلك انضم إلى شبكة «شبكة»، ومتى تقريبًا.',
  secN3:
    'كل المحتوى غير الخاص — المنشورات والملفات الشخصية والمتابعات والتفاعلات — علني ودائم. لا يوجد حذف؛ يستمر الأقران في نسخ ما نشرته.',
  secN4:
    'البيانات الوصفية للرسائل الخاصة علنية: مع من تتراسل ومتى وكم تقريبًا. المحتوى وحده مشفّر. لا سرّية أمامية: من يحصل على مفتاحك يقرأ كل رسائلك السابقة.',
  secN5:
    'مفتاحك يعيش في هذا المتصفح. البرمجيات الخبيثة أو إضافات المتصفح الخبيثة يمكنها سرقته. عبارة المرور تحمي المفتاح المخزّن فقط، لا أثناء فتح التطبيق.',

  errWrongPassphrase: 'عبارة المرور خاطئة.',
  errPassphraseRequired: 'عبارة المرور مطلوبة.',
  errNotBackup: 'هذه ليست نسخة احتياطية لمفتاح شبكة.',
  errBadSeed: 'النسخة الاحتياطية للمفتاح تالفة.',
}

const dicts: Record<Lang, Record<TKey, string>> = { en, ar }

export function translate(
  lang: Lang,
  key: TKey,
  params?: Record<string, string | number>,
): string {
  let s = dicts[lang][key] ?? en[key]
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v))
  }
  return s
}

/** Hook: returns a `t` bound to the current language. */
export function useT() {
  const lang = useApp((s) => s.lang)
  return (key: TKey, params?: Record<string, string | number>) => translate(lang, key, params)
}

/** Core modules throw English messages; map the known ones for display. */
const ERROR_KEYS: Record<string, TKey> = {
  'wrong passphrase': 'errWrongPassphrase',
  'passphrase required': 'errPassphraseRequired',
  'not a shabaka key backup': 'errNotBackup',
  'seed must be 32 bytes': 'errBadSeed',
}

export function translateError(lang: Lang, message: string): string {
  const key = ERROR_KEYS[message]
  return key ? translate(lang, key) : message
}
