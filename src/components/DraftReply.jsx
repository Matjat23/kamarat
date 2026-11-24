// "Draft my reply": cloud Gemini writes the reply with labels, and this device
// fills your real details back in. Shown under the explanation.
import { useMemo, useState } from 'react'
import { REPLY_INTENTS, draftReply, maskNote, fillIn, openItems } from '../reply'
import { detectWithAI } from '../privacy'
import { detectorModel, checkOnDeviceModel } from '../firebase'
import { ClipboardIcon, MailIcon, PenIcon, DeviceIcon, Dots } from './Icons'

// Labels of the given kinds, in the order they first appear in the notice.
function labelsOfType(labelMap, types, shared) {
  return Object.keys(labelMap)
    .filter((label) => types.some((type) => label.startsWith(`[${type}_`)))
    .sort((a, b) => shared.indexOf(a) - shared.indexOf(b))
}

export default function DraftReply({ shared, labelMap, details, language }) {
  // Names hidden by hand get the HIDDEN type, so offer those too.
  const nameLabels = labelsOfType(labelMap, ['NAME', 'HIDDEN'], shared)
  const caseLabels = labelsOfType(labelMap, ['CASE'], shared)

  const [intent, setIntent] = useState('send')
  const [note, setNote] = useState('')
  const [selfLabel, setSelfLabel] = useState(nameLabels[0] ?? '')
  const [caseLabel, setCaseLabel] = useState(caseLabels[0] ?? '')
  const [state, setState] = useState({ phase: 'idle' })
  const [letter, setLetter] = useState('')
  const [subject, setSubject] = useState('')
  const [showLabels, setShowLabels] = useState(false)
  const [copied, setCopied] = useState(false)

  // Live preview of the note as Gemini would get it (pattern check only;
  // on-device AI also checks it when you press the button).
  const preview = useMemo(() => maskNote(note, details, labelMap), [note, details, labelMap])
  const option = REPLY_INTENTS.find((o) => o.id === intent)
  const needsNote = option.needsNote && !note.trim()

  async function write() {
    setCopied(false)
    try {
      let aiItems = []
      if (note.trim() && (await checkOnDeviceModel()) === 'available') {
        setState({ phase: 'loading', status: 'Checking your note on your device...' })
        try {
          aiItems = (await detectWithAI(detectorModel, note)).items
        } catch (err) {
          console.warn('On-device check of the note failed, pattern check only.', err)
        }
      }
      const { masked, extraMap } = maskNote(note, details, labelMap, aiItems)

      setState({ phase: 'loading', status: 'Gemini is writing your reply...' })
      const draft = await draftReply({
        shared,
        intent,
        maskedNote: masked.trim(),
        language,
        selfLabel,
        caseLabel,
        onStatus: (status) => setState({ phase: 'loading', status }),
      })

      // Only these labels may be filled in: your name, the case you chose, and
      // details from your own note. Anything else stays visible for you to check.
      const allLabels = { ...labelMap, ...extraMap }
      const allowed = new Set([selfLabel, caseLabel, ...Object.keys(extraMap)].filter(Boolean))
      const filledLetter = fillIn(draft.reply, allLabels, allowed)
      setLetter(filledLetter)
      setSubject(fillIn(draft.subject, allLabels, allowed))
      setState({
        phase: 'done',
        draft,
        masked,
        allLabels,
        allowed,
        filled: [...allowed].filter((label) => draft.reply.includes(label)),
      })
    } catch (err) {
      setState({ phase: 'error', message: err.message })
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(letter)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const open = openItems(`${subject}\n${letter}`)
  const ready = open.fillIns.length === 0 && open.unknownLabels.length === 0
  const mailLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(letter)}`

  return (
    <div className="group reply">
      <div className="group-head">
        <span className="group-icon" aria-hidden="true"><PenIcon width={18} height={18} /></span>
        <h3>Draft my reply</h3>
        <span className="small muted">
          Gemini writes it with labels. Your real details are filled in on this device.
        </span>
      </div>

      <div className="intents" role="radiogroup">
        {REPLY_INTENTS.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={intent === o.id}
            className={`chip-button ${intent === o.id ? 'chip-selected' : ''}`}
            onClick={() => setIntent(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="roles">
        <label>
          <span className="small muted">Sign with your name</span>
          <select value={selfLabel} onChange={(e) => setSelfLabel(e.target.value)}>
            {nameLabels.map((label) => (
              <option key={label} value={label}>
                {labelMap[label]}
              </option>
            ))}
            <option value="">I will write my name myself</option>
          </select>
        </label>
        <label>
          <span className="small muted">Case number to mention</span>
          <select value={caseLabel} onChange={(e) => setCaseLabel(e.target.value)}>
            {caseLabels.map((label) => (
              <option key={label} value={label}>
                {labelMap[label]}
              </option>
            ))}
            <option value="">None</option>
          </select>
        </label>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder={
          intent === 'question'
            ? 'Your question, in your own words.'
            : 'Optional: which documents you attach, or why you need more time. Avoid names and health details; Kamarat adds your name and case number for you.'
        }
      />
      {note.trim() && (
        <p className="small muted">
          Gemini will get your note as: <em>{preview.masked}</em>
        </p>
      )}

      <button
        className="primary"
        onClick={write}
        disabled={state.phase === 'loading' || needsNote}
      >
        {state.phase === 'loading'
          ? <><Dots /> {state.status}</>
          : needsNote
            ? 'Write your question first'
            : state.phase === 'done'
              ? 'Write it again'
              : 'Write my reply'}
      </button>

      {state.phase === 'error' && (
        <p className="notice notice-warn">Could not write the reply: {state.message}. Try again in a minute.</p>
      )}

      {state.phase === 'done' && (
        <div className="reply-result">
          <p className="notice notice-ok small">
            <span className="badge badge-on_device"><DeviceIcon width={14} height={14} /> Filled in on your device</span>
            {state.filled.length > 0
              ? `${state.filled.map((l) => `${l} → ${state.allLabels[l]}`).join(', ')}. Gemini never saw these.`
              : 'Nothing to fill in.'}
          </p>

          <label className="small muted" htmlFor="reply-subject">Subject</label>
          <input
            id="reply-subject"
            className="reply-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <label className="small muted" htmlFor="reply-letter">Your reply (you can edit it)</label>
          <textarea
            id="reply-letter"
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            rows={10}
          />

          {!ready && (
            <p className="notice notice-warn small">
              {open.fillIns.length > 0 &&
                `Replace ${open.fillIns.length} [FILL IN: ...] part(s) with your own words. `}
              {open.unknownLabels.length > 0 &&
                `Check ${[...new Set(open.unknownLabels)].join(', ')}: Kamarat did not fill these in on purpose. Replace or remove them.`}
            </p>
          )}

          <div className="buttons">
            <button className="primary" onClick={copy}>
              <ClipboardIcon width={18} height={18} /> {copied ? 'Copied' : 'Copy reply'}
            </button>
            {ready ? (
              <a className="button-link" href={mailLink}>
                <MailIcon width={18} height={18} /> Open in email
              </a>
            ) : (
              <span className="button-link disabled" aria-disabled="true">
                <MailIcon width={18} height={18} /> Open in email (finish the gaps first)
              </span>
            )}
          </div>

          <details className="translation">
            <summary>What it says in {language}</summary>
            <p>{fillIn(state.draft.translation, state.allLabels, state.allowed)}</p>
          </details>

          <button className="link-button" onClick={() => setShowLabels(!showLabels)}>
            {showLabels ? 'Hide' : 'Show'} what Gemini got and wrote (before filling in)
          </button>
          {showLabels && (
            <>
              {state.masked && <pre className="shared-text">Your note as sent: {state.masked}</pre>}
              <pre className="shared-text">{state.draft.reply}</pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}
