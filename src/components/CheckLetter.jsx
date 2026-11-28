// Step 2: check what is private, then send, in one decision.
// The person sees the details Katty found, can show or hide each one, hide
// more text, see exactly what will be sent, pick the language, and send.
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildRedaction } from '../privacy'
import { mostlyWithoutCapitals } from '../namesAddresses.js'
import { t, msg } from '../i18n'
import { LANGUAGES, languageLabel } from '../explain'
import { LockIcon, ArrowIcon } from './Icons'
import { SharedText } from './Text'
import FlowHead from './FlowHead'

const TYPE_TEXT = {
  NAME: msg('Name'),
  ID: msg('ID number'),
  ADDRESS: msg('Address'),
  CASE: msg('Case number'),
  PHONE: msg('Phone'),
  EMAIL: msg('Email'),
  HIDDEN: msg('Hidden by you'),
}

const FOUND_BY_TEXT = {
  ai: msg('Found by on-device AI'),
  pattern: msg('Found by pattern check'),
  you: msg('Added by you'),
}

export default function CheckLetter({
  text,
  details,
  detection,
  readInfo,
  language,
  setLanguage,
  onToggle,
  onHideText,
  onBack,
  onSend,
}) {
  const [selection, setSelection] = useState('')
  const [extra, setExtra] = useState('')
  const [hideResult, setHideResult] = useState(null)
  // On phones only one of the two texts is shown at a time. Start with the
  // text that will actually be sent, since that is the decision being made.
  const [view, setView] = useState('shared')
  const needsConfirm = detection.mode !== 'ai'
  const noticeRef = useRef(null)
  const { segments, shared, labels } = useMemo(
    () => buildRedaction(text, details),
    [text, details],
  )
  const hiddenCount = details.filter((d) => d.hidden).length
  // Without Gemini Nano, the person confirms they checked for names and
  // addresses. The tick holds the text it was given for and is cleared as soon
  // as that text changes, so it never carries over to another version.
  const [confirmedText, setConfirmedText] = useState(null)
  if (confirmedText !== null && confirmedText !== shared) setConfirmedText(null)
  const confirmed = confirmedText === shared
  const noCapitals = needsConfirm && mostlyWithoutCapitals(text)
  const sentCount = details.length - hiddenCount

  // Works with a mouse and with a long press on a touch screen.
  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection()
      if (!sel || !noticeRef.current?.contains(sel.anchorNode)) return
      const picked = sel.toString().trim()
      setSelection(picked.length > 1 ? picked : '')
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  function hide(value) {
    const clean = value.trim()
    if (clean.length < 2) return
    const places = onHideText(clean)
    if (places === 0) {
      setHideResult({
        ok: false,
        text: t('No matching text found for "{text}". Check the spelling, or select the text in your letter instead.', {
          text: clean,
        }),
      })
      return
    }
    setHideResult({
      ok: true,
      text: places === 1 ? t('"{text}" hidden.', { text: clean }) : t('"{text}" hidden in {count} places.', { text: clean, count: places }),
    })
    setSelection('')
    setExtra('')
    window.getSelection()?.removeAllRanges()
  }

  // Arrow keys move between the two tabs, as screen reader users expect.
  function onTabKey(event) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const next = view === 'notice' ? 'shared' : 'notice'
      setView(next)
      document.getElementById(`tab-${next}`)?.focus()
    }
  }

  function send() {
    // Label to real text, for filling a drafted reply back in on this device.
    const labelMap = {}
    for (const detail of details) {
      const label = labels.get(detail.id)
      if (label) labelMap[label] = detail.text
    }
    onSend(shared, labelMap)
  }

  return (
    <section className="card flow-card">
      <FlowHead step={2} title={t('Check what is private')} backLabel={t('Back')} onBack={onBack} />

      <p className="lead-small">
        {detection.mode === 'ai'
          ? t('Gemini Nano found these personal details on your device. They stay here. Hide anything it missed.')
          : t('There is no on-device AI here, so Katty looked for personal details with simple rules. They stay on your device. Rules can miss things: read "What will be sent" and hide anything about you.')}
      </p>
      <span className="count-pill" role="status">
        <LockIcon width={16} height={16} /> {t('{count} hidden', { count: hiddenCount })}
        {sentCount > 0 && <span className="count-sent"> · {t('{count} will be sent', { count: sentCount })}</span>}
      </span>
      {readInfo?.method === 'tesseract' && detection.mode !== 'ai' && (
        <p className="notice notice-warn small" role="status">
          {t('This text was read from a photo, so a name or number can be spelled differently than on your letter. Compare "What will be sent" with your paper letter.')}
        </p>
      )}
      {readInfo?.missing && (
        <p className="notice notice-warn small" role="status">
          {t('Only pages 1 to {read} of {total} were read. If a later page has a date or a decision, add its text, or Katty can miss it.', readInfo.pages)}
        </p>
      )}
      {noCapitals && (
        <p className="notice notice-warn small" role="alert">
          {t('This letter uses a script without capital letters, so Katty cannot find names in it here. Look for names yourself and hide them below.')}
        </p>
      )}
      {detection.lost?.length > 0 && (
        <p className="notice notice-warn small" role="alert" translate="no">
          {t('You hid {text} before, but it is not in the text any more. If you changed how it is written, hide it again below.', {
            text: detection.lost.map((lost) => `"${lost}"`).join(', '),
          })}
        </p>
      )}

      {/* The details themselves never go to a browser translation service. */}
      <div className="details-list" role="list" translate="no">
        {details.length === 0 && (
          <p className="muted small">{t('No personal details found yet. Hide anything you want below.')}</p>
        )}
        {details.map((detail) => (
          <label
            key={detail.id}
            role="listitem"
            className={`detail ${detail.hidden ? 'detail-hidden' : 'detail-sent'}`}
            title={t(FOUND_BY_TEXT[detail.foundBy[0]])}
          >
            <span className={`type-dot type-${detail.type}`} aria-hidden="true" />
            <span className="detail-type">{t(TYPE_TEXT[detail.type])}</span>
            <span className="detail-text">{detail.text}</span>
            <span className={`state-label ${detail.hidden ? 'state-hidden' : 'state-sent'}`}>
              {detail.hidden ? t('Hidden') : t('Will be sent')}
            </span>
            <input
              className="switch"
              type="checkbox"
              role="switch"
              aria-label={`${t('Hide')} ${t(TYPE_TEXT[detail.type])} ${detail.text}`}
              checked={detail.hidden}
              onChange={() => onToggle(detail.id)}
            />
          </label>
        ))}
      </div>

      <div className="hide-more">
        <label htmlFor="hide-more-input" className="visually-hidden">
          {t('Hide something else')}
        </label>
        <input
          id="hide-more-input"
          translate="no"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && hide(extra)}
          placeholder={t('Hide something else, for example your name or employer')}
        />
        <button className="secondary" onClick={() => hide(extra)} disabled={extra.trim().length < 2}>
          {t('Hide')}
        </button>
      </div>
      {hideResult && (
        <p
          className={`small ${hideResult.ok ? 'hide-ok' : 'warning-text'}`}
          role={hideResult.ok ? 'status' : 'alert'}
        >
          {hideResult.text}
        </p>
      )}

      <div className="view-toggle" role="tablist" aria-label={t('Which text to show')} onKeyDown={onTabKey}>
        <button
          id="tab-shared"
          role="tab"
          aria-selected={view === 'shared'}
          tabIndex={view === 'shared' ? 0 : -1}
          className={view === 'shared' ? 'active' : ''}
          onClick={() => setView('shared')}
        >
          {t('What will be sent')}
        </button>
        <button
          id="tab-notice"
          role="tab"
          aria-selected={view === 'notice'}
          tabIndex={view === 'notice' ? 0 : -1}
          className={view === 'notice' ? 'active' : ''}
          onClick={() => setView('notice')}
        >
          {t('Your letter')}
        </button>
      </div>

      <div className={`compare show-${view}`}>
        <div className="pane pane-notice">
          <div className="pane-head">
            <span>{t('Your letter')}</span>
            {selection ? (
              <button className="primary hide-selection" onClick={() => hide(selection)}>
                {t('Hide')} <span translate="no">"{selection.length > 24 ? `${selection.slice(0, 24)}...` : selection}"</span>
              </button>
            ) : (
              <span className="small muted">{t('stays on this device')}</span>
            )}
          </div>
          <div className="pane-body" ref={noticeRef} dir="auto" translate="no">
            {segments.map((seg, i) =>
              seg.detail ? (
                <mark key={i} className={`hl hl-${seg.detail.type}`} title={seg.label}>
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>
          <p className="small muted">{t('Select any text here (press and hold on a phone) to hide it.')}</p>
        </div>

        <div className="pane pane-shared">
          <div className="pane-head">
            <span>{t('What will be sent')}</span>
            <span className="small muted">{t('black bars stay on this device')}</span>
          </div>
          <SharedText text={shared} className="pane-body" />
        </div>
      </div>

      <div className="send-box">
        <p className="small muted">
          {t('When you continue, the text under "What will be sent" goes to Google Gemini to be explained. The black bars stay on this device.')}
        </p>
        {needsConfirm && (
          <label className="check-line confirm-line">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmedText(e.target.checked ? shared : null)} />
            {t('I read "What will be sent". My name, address and other details about me are hidden.')}
          </label>
        )}
        <div className="action-bar is-sticky row-between">
          <label className="language">
            <span className="small muted">{t('Language')}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.name} value={l.name}>
                  {languageLabel(l)}
                </option>
              ))}
            </select>
          </label>
          <button className="primary big" onClick={send} disabled={needsConfirm && !confirmed}>
            {t('Explain my letter')} <ArrowIcon className="arrow-forward" />
          </button>
        </div>
      </div>
    </section>
  )
}
