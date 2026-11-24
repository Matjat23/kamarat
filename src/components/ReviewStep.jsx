// Step 2: the person sees their notice next to what would be shared,
// can show or hide each detail, hide more text, and then approve.
import { useMemo, useState } from 'react'
import { buildRedaction, TYPE_LABELS } from '../privacy'

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
  const { segments, shared, labels } = useMemo(
    () => buildRedaction(text, details),
    [text, details],
  )
  const hiddenCount = details.filter((d) => d.hidden).length

  function rememberSelection() {
    const picked = window.getSelection()?.toString().trim() ?? ''
    setSelection(picked.length > 1 ? picked : '')
  }

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
      <h2>Check what leaves your device</h2>

      {detection.mode === 'ai' ? (
        <p className="notice notice-ok">
          <span className="badge badge-on_device">On your device</span>
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
          <label key={detail.id} className={`detail detail-${detail.type}`}>
            <input
              type="checkbox"
              checked={detail.hidden}
              onChange={() => onToggle(detail.id)}
            />
            <span className="detail-text">{detail.text}</span>
            <span className="detail-meta">
              {detail.hidden && labels.get(detail.id) ? `${labels.get(detail.id)} · ` : ''}
              {detail.type === 'HIDDEN'
                ? TYPE_LABELS.HIDDEN
                : `${TYPE_LABELS[detail.type]}, ${detail.foundBy.map((f) => FOUND_BY_TEXT[f]).join(' and ')}`}
            </span>
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
        <button onClick={() => hide(extra)} disabled={extra.trim().length < 2}>
          Hide
        </button>
        {selection && (
          <button className="primary" onClick={() => hide(selection)}>
            Hide "{selection.length > 30 ? `${selection.slice(0, 30)}...` : selection}"
          </button>
        )}
      </div>

      <div className="compare">
        <div className="pane">
          <div className="pane-head">
            <span>Your notice</span>
            <span className="small muted">stays on this device</span>
          </div>
          <div className="pane-body" onMouseUp={rememberSelection}>
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
          <p className="small muted">Tip: select any text here to hide it.</p>
        </div>

        <div className="pane">
          <div className="pane-head">
            <span>What would be shared</span>
            <span className="small muted">{hiddenCount} detail(s) hidden</span>
          </div>
          <div className="pane-body">
            {segments.map((seg, i) =>
              seg.detail ? (
                <span key={i} className={`label label-${seg.detail.type}`}>
                  {seg.label}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="row-between">
        <button onClick={onBack}>Back</button>
        <button className="primary" onClick={() => onApprove(shared)}>
          Approve what is shared
        </button>
      </div>
    </section>
  )
}
