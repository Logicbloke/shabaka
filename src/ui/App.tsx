import { navigate, setLang, useApp } from '../state/store'
import { useT } from './i18n'
import { Onboarding } from './Onboarding'
import { Feed } from './Feed'
import { Thread } from './Thread'
import { Profile } from './Profile'
import { FollowManager } from './FollowManager'
import { Notifications } from './Notifications'
import { DmList } from './DmList'
import { DmConversation } from './DmConversation'
import { PeerStatus } from './PeerStatus'
import { Security } from './Security'
import { UpdateBanner } from './UpdateBanner'
import { Toaster } from './Toaster'

export function LangToggle() {
  const lang = useApp((s) => s.lang)
  return (
    <button
      className="lang-toggle"
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      lang={lang === 'ar' ? 'en' : 'ar'}
    >
      {lang === 'ar' ? 'EN' : 'عربي'}
    </button>
  )
}

function Main() {
  const view = useApp((s) => s.view)
  switch (view.name) {
    case 'thread':
      return <Thread root={view.root} />
    case 'profile':
      return <Profile author={view.author} />
    case 'follows':
      return <FollowManager />
    case 'notifications':
      return <Notifications />
    case 'dms':
      return <DmList />
    case 'dm':
      return <DmConversation other={view.other} />
    case 'security':
      return <Security />
    default:
      return <Feed />
  }
}

export function App() {
  const phase = useApp((s) => s.phase)
  const identity = useApp((s) => s.identity)
  const notifUnread = useApp((s) => s.notifUnread)
  const t = useT()

  if (phase !== 'ready' || !identity) {
    return <Onboarding phase={phase} />
  }

  return (
    <div className="app">
      <UpdateBanner />
      <Toaster />
      <header>
        <span className="brand" onClick={() => navigate({ name: 'feed' })}>
          {t('brand')}
        </span>
        <nav>
          <button onClick={() => navigate({ name: 'feed' })}>{t('navFeed')}</button>
          <button onClick={() => navigate({ name: 'follows' })}>{t('navFollows')}</button>
          <button onClick={() => navigate({ name: 'notifications' })}>
            {t('navNotifications')}
            {notifUnread > 0 && <span className="nav-badge">{notifUnread}</span>}
          </button>
          <button onClick={() => navigate({ name: 'dms' })}>{t('navDms')}</button>
          <button onClick={() => navigate({ name: 'profile', author: identity.pub })}>
            {t('navMe')}
          </button>
          <button onClick={() => navigate({ name: 'security' })}>{t('navSecurity')}</button>
        </nav>
        <LangToggle />
        <PeerStatus />
      </header>
      <main>
        <Main />
      </main>
    </div>
  )
}
