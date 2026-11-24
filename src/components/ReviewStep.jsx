// Step 2: check what is shared and send it, in one decision.
// The person sees their notice next to what would be sent, can show or hide
// each detail, hide more text, pick the language, and send.
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildRedaction, TYPE_LABELS } from '../privacy'
import { LANGUAGES } from '../explain'
import { LockIcon, DeviceIcon, ArrowIcon, CloudIcon } from './Icons'
import { SharedText } from './ExplainStep'

const FOUND_BY_TEXT = {
  ai: 'Found by on-device AI',
  pattern: 'Found by pattern check',
  you: 'Added by you',
}

export default function ReviewStep({
  text,
  details,
  detection,
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
  const noticeRef = useRef(null)
  const { segments, shared, labels } = useMemo(
    () => buildRedaction(text, details),
    [text, details],
  )
  const hiddenCount = details.filter((d) => d.hidden).length
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
        text: `No matching text found for "${clean}". Check the spelling, or select the text in your notice instead.`,
      })
      return
    }
    setHideResult({ ok: true, text: `"${clean}" hidden in ${places} place${places === 1 ? '' : 's'}.` })
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
    <section className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Step 2 of 3</span>
          <h2 tabIndex={-1} data-step-heading>Check what leaves your device</h2>
        </div>
        <span className="count-pill" role="status">
          <LockIcon width={16} height={16} /> {hiddenCount} detail{hiddenCount === 1 ? '' : 's'} hidden
          {sentCount > 0 && <span className="count-sent"> · {sentCount} will be sent</span>}
        </span>
      </div>

      {detection.mode === 'ai' ? (
        <p className="notice notice-ok">
          <span className="badge badge-on_device"><DeviceIcon width={14} height={14} /> On your device</span>
          Gemini Nano looked for personal details without sending anything. Check the list, and hide anything it missed.
          {detection.ignored > 0 &&
            ` It also suggested ${detection.ignored} item(s) that are not in your text, so they were ignored.`}
        </p>
      ) : (
        <p className="notice notice-warn" role="status">
          Basic check only: Kamarat looked for numbers and emails on your device. Names and addresses
          may be missing from the list. Read your notice and hide anything else that is about you.
        </p>
      )}

      <div className="details-list" role="list">
        {details.length === 0 && (
          <p className="muted small">No personal details found yet. Hide anything you want below.</p>
        )}
        {details.map((detail) => (
          <label
            key={detail.id}
            role="listitem"
            className={`detail ${detail.hidden ? 'detail-hidden' : 'detail-sent'}`}
            title={FOUND_BY_TEXT[detail.foundBy[0]]}
          >
            <span className={`type-dot type-${detail.type}`} aria-hidden="true" />
            <span className="detail-type">{TYPE_LABELS[detail.type]}</span>
            <span className="detail-text">{detail.text}</span>
            <span className={`state-label ${detail.hidden ? 'state-hidden' : 'state-sent'}`}>
              {detail.hidden ? 'Hidden' : 'Will be sent'}
            </span>
            <input
              className="switch"
              type="checkbox"
              role="switch"
              aria-label={`Hide ${TYPE_LABELS[detail.type]} ${detail.text}`}
              checked={detail.hidden}
              onChange={() => onToggle(detail.id)}
            />
          </label>
        ))}
      </div>

      <div className="hide-more">
        <label htmlFor="hide-more-input" className="visually-hidden">
          Hide something else
        </label>
        <input
          id="hide-more-input"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && hide(extra)}
          placeholder="Hide something else, for example your employer"
        />
        <button className="secondary" onClick={() => hide(extra)} disabled={extra.trim().length < 2}>
          Hide
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

      <div className="view-toggle" role="tablist" aria-label="Which text to show" onKeyDown={onTabKey}>
        <button
          id="tab-shared"
          role="tab"
          aria-selected={view === 'shared'}
          tabIndex={view === 'shared' ? 0 : -1}
          className={view === 'shared' ? 'active' : ''}
          onClick={() => setView('shared')}
        >
          What will be sent
        </button>
        <button
          id="tab-notice"
          role="tab"
          aria-selected={view === 'notice'}
          tabIndex={view === 'notice' ? 0 : -1}
          className={view === 'notice' ? 'active' : ''}
          onClick={() => setView('notice')}
        >
          Your notice
        </button>
      </div>

      <div className={`compare show-${view}`}>
        <div className="pane pane-notice">
          <div className="pane-head">
            <span>Your notice</span>
            {selection ? (
              <button className="primary hide-selection" onClick={() => hide(selection)}>
                Hide "{selection.length > 24 ? `${selection.slice(0, 24)}...` : selection}"
              </button>
            ) : (
              <span className="small muted">stays on this device</span>
            )}
          </div>
          <div className="pane-body" ref={noticeRef}>
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
          <p className="small muted">Tip: select any text here (press and hold on a phone) to hide it.</p>
        </div>

        <div className="pane pane-shared">
          <div className="pane-head">
            <span>What will be sent</span>
            <span className="small muted">black bars stay on this device</span>
          </div>
          <SharedText text={shared} className="pane-body" />
        </div>
      </div>

      <div className="send-box">
        <p className="send-explainer">
          <CloudIcon width={18} height={18} />
          <span>
            The visible text goes to Google Gemini through Firebase to be explained. Hidden details
            are replaced with labels and stay on this device.
          </span>
        </p>
        <div className="action-bar is-sticky row-between">
          <label className="language">
            <span className="small muted">Explain in</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.native}
                </option>
              ))}
            </select>
          </label>
          <div className="buttons">
            <button className="secondary" onClick={onBack}>
              Back
            </button>
            <button className="primary big" onClick={send}>
              Send reviewed text and explain <ArrowIcon />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
