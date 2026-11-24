// Step 2: the person sees their notice next to what would be shared,
// can show or hide each detail, hide more text, and then approve.
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildRedaction, TYPE_LABELS } from '../privacy'
import { LockIcon, DeviceIcon, ArrowIcon } from './Icons'

const FOUND_BY_TEXT = {
  ai: 'found by on-device AI',
  pattern: 'found by pattern check',
  you: 'hidden by you',
}

export default function ReviewStep({
  text,
  details,
  detection,
  onToggle,
  onHideText,
  onBack,
  onApprove,
}) {
  const [selection, setSelection] = useState('')
  const [extra, setExtra] = useState('')
  // On phones only one of the two texts is shown at a time.
  const [view, setView] = useState('notice')
  const noticeRef = useRef(null)
  const { segments, shared, labels } = useMemo(
    () => buildRedaction(text, details),
    [text, details],
  )
  const hiddenCount = details.filter((d) => d.hidden).length

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
    onHideText(clean)
    setSelection('')
    setExtra('')
    window.getSelection()?.removeAllRanges()
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Step 2 of 3</span>
          <h2>Check what leaves your device</h2>
        </div>
        <span className="count-pill">
          <LockIcon width={16} height={16} /> {hiddenCount} hidden
        </span>
      </div>

      {detection.mode === 'ai' ? (
        <p className="notice notice-ok">
          <span className="badge badge-on_device"><DeviceIcon width={14} height={14} /> On your device</span>
          Gemini Nano looked for personal details without sending anything.
          {detection.ignored > 0 &&
            ` It also suggested ${detection.ignored} item(s) that are not in your text, so they were ignored.`}
        </p>
      ) : (
        <p className="notice notice-warn">
          Private on-device AI is not available here, so nothing was sent anywhere.
          Only the pattern check ran. Read your notice carefully and hide anything
          else that is about you.
        </p>
      )}

      <div className="details-list">
        {details.length === 0 && (
          <p className="muted small">No personal details found yet. Hide anything you want below.</p>
        )}
        {details.map((detail) => (
          <label key={detail.id} className={`detail detail-${detail.type} ${detail.hidden ? '' : 'detail-shown'}`}>
            <span className={`type-dot type-${detail.type}`} aria-hidden="true" />
            <span className="detail-body">
              <span className="detail-text">{detail.text}</span>
              <span className="detail-meta">
                {detail.type === 'HIDDEN'
                  ? TYPE_LABELS.HIDDEN
                  : `${TYPE_LABELS[detail.type]}, ${detail.foundBy.map((f) => FOUND_BY_TEXT[f]).join(' and ')}`}
                {detail.hidden && labels.get(detail.id) ? ` · shared as ${labels.get(detail.id)}` : ' · will be shared'}
              </span>
            </span>
            <input
              className="switch"
              type="checkbox"
              role="switch"
              aria-label={`Hide ${detail.text}`}
              checked={detail.hidden}
              onChange={() => onToggle(detail.id)}
            />
          </label>
        ))}
      </div>

      <div className="hide-more">
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && hide(extra)}
          placeholder="Hide something else, for example your employer"
        />
        <button className="secondary" onClick={() => hide(extra)} disabled={extra.trim().length < 2}>
          Hide
        </button>
      </div>

      <div className="view-toggle" role="tablist">
        <button
          role="tab"
          aria-selected={view === 'notice'}
          className={view === 'notice' ? 'active' : ''}
          onClick={() => setView('notice')}
        >
          Your notice
        </button>
        <button
          role="tab"
          aria-selected={view === 'shared'}
          className={view === 'shared' ? 'active' : ''}
          onClick={() => setView('shared')}
        >
          What would be shared
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
          <p className="small muted">Tip: select any text here (long-press on a phone) to hide it.</p>
        </div>

        <div className="pane pane-shared">
          <div className="pane-head">
            <span>What would be shared</span>
            <span className="small muted">{hiddenCount} detail(s) hidden</span>
          </div>
          <div className="pane-body">
            {segments.map((seg, i) =>
              seg.detail ? (
                <span key={i} className="redact" title={seg.label}>
                  <span className="redact-label">{seg.label.slice(1, -1).replace('_', ' ')}</span>
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="action-bar row-between">
        <button className="secondary" onClick={onBack}>Back</button>
        <button
          className="primary big"
          onClick={() => {
            // Label to real text, for filling a drafted reply back in on this device.
            const labelMap = {}
            for (const detail of details) {
              const label = labels.get(detail.id)
              if (label) labelMap[label] = detail.text
            }
            onApprove(shared, labelMap)
          }}
        >
          Approve what is shared <ArrowIcon />
        </button>
      </div>
    </section>
  )
}
