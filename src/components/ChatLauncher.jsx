// The round chat button in the corner (computers only; phones have Ask in the
// tab bar) and the small chat panel it opens: Ask Katty without leaving the
// page. The panel keeps the conversation while you look around, until the page
// is reloaded. Nothing is sent until you ask, like on the Ask page.
import { useEffect, useId, useRef, useState } from 'react'
import AskGuide from './AskGuide'
import { t } from '../i18n'
import { CloseIcon, WavingKatty } from './Icons'

export default function ChatLauncher({ country, language, onAddLetter, hidden }) {
  const [open, setOpen] = useState(false)
  // The chat is made the first time it opens, then kept while it is closed.
  const [started, setStarted] = useState(false)
  const button = useRef(null)
  const title = useRef(null)
  const uid = useId()

  useEffect(() => {
    if (!open) return undefined
    title.current?.focus()
    function onKey(event) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    setOpen(false)
    requestAnimationFrame(() => button.current?.focus())
  }

  function toggle() {
    if (open) {
      close()
    } else {
      setStarted(true)
      setOpen(true)
    }
  }

  return (
    <div className="chat-launcher" hidden={hidden}>
      {started && (
        <section className="chat-panel" role="dialog" aria-modal="false" aria-labelledby={`${uid}-title`} hidden={!open}>
          <header className="chat-panel-head">
            <span className="chat-panel-title">
              <span className="chat-avatar"><WavingKatty size={24} /></span>
              <h2 id={`${uid}-title`} ref={title} tabIndex={-1}>{t('Ask Katty')}</h2>
            </span>
            <button className="chat-panel-close" onClick={close} aria-label={t('Close')}>
              <CloseIcon width={20} height={20} />
            </button>
          </header>
          <div className="chat-panel-body">
            <AskGuide
              compact
              country={country}
              language={language}
              onAddLetter={() => {
                close()
                onAddLetter()
              }}
            />
          </div>
        </section>
      )}
      <button ref={button} className="chat-bubble" aria-expanded={open} aria-label={t('Ask Katty')} onClick={toggle}>
        {open ? <CloseIcon width={24} height={24} /> : <WavingKatty size={36} />}
      </button>
    </div>
  )
}
