// The menu behind the "Menu" button: a full screen panel with big, plain
// links, one main button and the language at the bottom.
import { useEffect, useRef } from 'react'
import { t } from '../i18n'
import { isPhone } from '../device'
import { Logo, CameraIcon, GlobeIcon, CloseIcon } from './Icons'

export default function SiteMenu({ open, onClose, active, papersCount, language, country, onHome, onMove, onAsk, onNew, onPapers, onScan, onSettings }) {
  const panel = useRef(null)
  const firstLink = useRef(null)

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
        onClose()
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
  }, [open, onClose])

  if (!open) return null

  function pick(action) {
    onClose()
    action()
  }

  const links = [
    { id: 'home', label: t('Home'), action: onHome },
    { id: 'move', label: t('My move'), action: onMove },
    { id: 'ask', label: t('Ask Kamarat'), action: onAsk },
    { id: 'new', label: t('Add a letter'), action: onNew },
    { id: 'papers', label: t('My papers'), action: onPapers, count: papersCount },
    { id: 'settings', label: t('Language and country'), action: onSettings },
  ]

  return (
    <div className="site-menu" role="dialog" aria-modal="true" aria-label={t('Menu')} ref={panel}>
      <div className="site-menu-top">
        <span className="site-menu-brand">
          <Logo size={34} />
          <span className="wordmark">Kamarat</span>
        </span>
        <button className="menu-toggle menu-close" onClick={onClose}>
          <CloseIcon width={30} height={30} />
          <span>{t('Close')}</span>
        </button>
      </div>

      <nav className="site-menu-body" aria-label={t('Main')}>
        <ul className="site-menu-links">
          {links.map((link, i) => (
            <li key={link.id}>
              <button
                ref={i === 0 ? firstLink : undefined}
                className={active === link.id ? 'is-active' : ''}
                aria-current={active === link.id ? 'page' : undefined}
                onClick={() => pick(link.action)}
              >
                {link.label}
                {link.count > 0 && <span className="papers-count">{link.count}</span>}
              </button>
            </li>
          ))}
        </ul>

        <button className="primary site-menu-scan" onClick={() => pick(onScan)}>
          <CameraIcon width={24} height={24} /> {isPhone() ? t('Scan a letter') : t('Add a letter')}
        </button>

        <button className="site-menu-language" onClick={() => pick(onSettings)}>
          <GlobeIcon width={24} height={24} />
          <span>{language}{country ? ` · ${country}` : ''}</span>
        </button>
      </nav>
    </div>
  )
}
