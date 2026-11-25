// The menu behind the "Menu" button: a drawer that slides in from the side,
// with the page still visible (dimmed) behind it. Links are rows, like the
// More screen on phones; the page you are on is marked.
import { useEffect, useRef } from 'react'
import { t } from '../i18n'
import { LANGUAGES } from '../explain'
import { countryName } from '../countries'
import { GlobeIcon, CloseIcon, HomeIcon, ListIcon, ChatIcon, CameraIcon, FolderIcon, ChevronIcon } from './Icons'

export default function SiteMenu({ open, onClose, active, papersCount, language, country, onHome, onMove, onAsk, onNew, onPapers, onSettings }) {
  const panel = useRef(null)
  const firstLink = useRef(null)
  // The latest onClose, so the effect below only runs when the menu opens or
  // closes, not every time the app updates (which would move focus).
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // While open: the page behind does not scroll, Escape closes, and Tab stays
  // inside the panel.
  useEffect(() => {
    if (!open) return undefined
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstLink.current?.focus()

    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = [...panel.current.querySelectorAll('button:not([disabled])')]
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = before
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!open) return null

  function pick(action) {
    onClose()
    action()
  }

  const links = [
    { id: 'home', label: t('Home'), icon: HomeIcon, action: onHome },
    { id: 'move', label: t('My move'), icon: ListIcon, action: onMove },
    { id: 'ask', label: t('Ask Katty'), icon: ChatIcon, action: onAsk },
    { id: 'new', label: t('Add a letter'), icon: CameraIcon, action: onNew },
    { id: 'papers', label: t('My papers'), icon: FolderIcon, action: onPapers, count: papersCount },
  ]
  const native = LANGUAGES.find((l) => l.name === language)?.native ?? language

  return (
    <div className="site-menu">
      {/* Clicking the dimmed page closes the menu, like Escape. */}
      <div className="site-menu-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="site-menu-panel" role="dialog" aria-modal="true" aria-label={t('Menu')} ref={panel}>
        <div className="site-menu-top">
          <span className="site-menu-title">{t('Menu')}</span>
          <button className="site-menu-close" onClick={onClose}>
            <CloseIcon width={24} height={24} />
            <span>{t('Close')}</span>
          </button>
        </div>

        <nav className="site-menu-body" aria-label={t('Main')}>
          <ul className="row-group site-menu-links">
            {links.map((link, i) => (
              <li key={link.id}>
                <button
                  ref={i === 0 ? firstLink : undefined}
                  className={`row ${active === link.id ? 'is-active' : ''}`}
                  aria-current={active === link.id ? 'page' : undefined}
                  onClick={() => pick(link.action)}
                >
                  <link.icon className="row-icon" width={20} height={20} />
                  <span className="row-text">
                    <span className="row-label">{link.label}</span>
                  </span>
                  {link.count > 0 && <span className="papers-count">{link.count}</span>}
                  <ChevronIcon className="row-chevron arrow-forward" width={18} height={18} />
                </button>
              </li>
            ))}
          </ul>

          <ul className="row-group site-menu-links">
            <li>
              <button
                className={`row ${active === 'settings' ? 'is-active' : ''}`}
                aria-current={active === 'settings' ? 'page' : undefined}
                onClick={() => pick(onSettings)}
              >
                <GlobeIcon className="row-icon" width={20} height={20} />
                <span className="row-text">
                  <span className="row-label">{t('Language and country')}</span>
                  <span className="row-sub">{native}{country ? ` · ${countryName(country)}` : ''}</span>
                </span>
                <ChevronIcon className="row-chevron arrow-forward" width={18} height={18} />
              </button>
            </li>
          </ul>
        </nav>
      </aside>
    </div>
  )
}
