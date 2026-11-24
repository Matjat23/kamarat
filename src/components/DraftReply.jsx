// "Draft my reply": cloud Gemini writes the reply with labels, and this device
// fills your real details back in. Shown under the next steps.
//
// Safety rules here:
// - Kamarat never guesses who you are: you choose your own name for the signature.
// - Your own message is checked on the device, and you see exactly what Gemini
//   will get before it is sent.
// - If you edit the reply afterwards, the translation is marked as out of date.
import { useMemo, useState } from 'react'
import { REPLY_INTENTS, draftReply, maskNote, fillIn, openItems } from '../reply'
import { detectWithAI } from '../privacy'
import { languageProps } from '../explain'
import { detectorModel, checkOnDeviceModel } from '../firebase'
import { ClipboardIcon, MailIcon, PenIcon, DeviceIcon, Dots } from './Icons'
import { SharedText } from './ExplainStep'

const WRITE_MYSELF = '__self'

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
  const [selfChoice, setSelfChoice] = useState('')
  // With exactly one case number there is nothing to guess.
  const [caseLabel, setCaseLabel] = useState(caseLabels.length === 1 ? caseLabels[0] : '')
  const [state, setState] = useState({ phase: 'idle' })
  const [letter, setLetter] = useState('')
  const [subject, setSubject] = useState('')
  const [showLabels, setShowLabels] = useState(false)
  const [copied, setCopied] = useState(false)

  const selfLabel = selfChoice === WRITE_MYSELF ? '' : selfChoice
  const preview = useMemo(() => maskNote(note, details, labelMap), [note, details, labelMap])
  const option = REPLY_INTENTS.find((o) => o.id === intent)
  const needsNote = option.needsNote && !note.trim()
  const needsName = !selfChoice
  const langProps = languageProps(language)

  // Step 1: check the message on the device, then show the final version.
  async function prepare() {
    setCopied(false)
    if (!note.trim()) return write({ masked: '', extraMap: {} })
    let aiItems = []
    if ((await checkOnDeviceModel()) === 'available') {
      setState({ phase: 'loading', status: 'Checking your message on your device...' })
      try {
        aiItems = (await detectWithAI(detectorModel, note)).items
      } catch (err) {
        console.warn('On-device check of the message failed, pattern check only.', err)
      }
    }
    setState({ phase: 'confirm', ...maskNote(note, details, labelMap, aiItems) })
  }

  // Step 2: send the checked message and the notice to Gemini, then fill in.
  async function write({ masked, extraMap }) {
    setState({ phase: 'loading', status: 'Gemini is writing your reply...' })
    try {
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
      // details from your own message. Anything else stays visible for you to check.
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
        firstLetter: filledLetter,
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
  const edited = state.phase === 'done' && letter !== state.firstLetter

  return (
    <div className="group reply">
      <div className="group-head">
        <span className="group-icon" aria-hidden="true"><PenIcon width={18} height={18} /></span>
        <h3>Draft my reply</h3>
        <span className="small muted">
          Gemini writes it with labels. Your real details are filled in on this device.
        </span>
      </div>

      <fieldset className="intents">
        <legend className="visually-hidden">What do you want to say?</legend>
        {REPLY_INTENTS.map((o) => (
          <label key={o.id} className={`chip-button chip-radio ${intent === o.id ? 'chip-selected' : ''}`}>
            <input
              type="radio"
              name="reply-intent"
              value={o.id}
              checked={intent === o.id}
              onChange={() => setIntent(o.id)}
              className="visually-hidden"
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      <div className="roles">
        <label>
          <span className="small muted">Sign with your name</span>
          <select value={selfChoice} onChange={(e) => setSelfChoice(e.target.value)}>
            <option value="" disabled>
              Choose your name...
            </option>
            {nameLabels.map((label) => (
              <option key={label} value={label}>
                {labelMap[label]}
              </option>
            ))}
            <option value={WRITE_MYSELF}>I will write my name myself</option>
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

      <label htmlFor="reply-note" className="small muted">
        {intent === 'question' ? 'Your question' : 'Your message (optional)'}
      </label>
      <textarea
        id="reply-note"
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          if (state.phase === 'confirm') setState({ phase: 'idle' })
        }}
        rows={3}
        aria-describedby="reply-note-help"
        placeholder={
          intent === 'question'
            ? 'Your question, in your own words.'
            : 'For example which documents you attach, or why you need more time.'
        }
      />
      <p id="reply-note-help" className="small muted">
        Avoid names and health details. Kamarat adds your name and case number for you, on this device.
      </p>
      {note.trim() && state.phase !== 'confirm' && (
        <div className="review-note">
          <span className="quote-head">Preview · numbers and emails hidden</span>
          <SharedText text={preview.masked} className="review-note-text" />
        </div>
      )}

      {state.phase === 'confirm' ? (
        <div className="review-note review-final" role="status">
          <span className="quote-head">Final check · this is exactly what Gemini gets from your message</span>
          <SharedText text={state.masked} className="review-note-text" />
          <span className="small muted">
            If you see a name or anything private, edit your message. Otherwise send it.
          </span>
          <div className="buttons">
            <button className="secondary" onClick={() => setState({ phase: 'idle' })}>
              Edit message
            </button>
            <button className="primary" onClick={() => write(state)}>
              Send to Gemini and write the reply
            </button>
          </div>
        </div>
      ) : (
        <button
          className="primary"
          onClick={prepare}
          disabled={state.phase === 'loading' || needsNote || needsName}
        >
          {state.phase === 'loading'
            ? <span role="status"><Dots /> {state.status}</span>
            : needsName
              ? 'Choose your name first'
              : needsNote
                ? 'Write your question first'
                : state.phase === 'done'
                  ? 'Write it again'
                  : 'Write my reply'}
        </button>
      )}

      {state.phase === 'error' && (
        <p className="notice notice-warn" role="alert">Could not write the reply: {state.message}. Try again in a minute.</p>
      )}

      {state.phase === 'done' && (
        <div className="reply-result">
          <h4>Draft ready. Check it before you send it.</h4>
          <p className="notice notice-ok small">
            <span className="badge badge-on_device"><DeviceIcon width={14} height={14} /> Filled in on your device</span>
            {state.filled.length > 0
              ? `Your ${state.filled
                  .map((l) =>
                    l === selfLabel ? 'name' : l === caseLabel ? 'case number' : 'details from your message',
                  )
                  .filter((v, i, all) => all.indexOf(v) === i)
                  .join(' and ')} were added on this device. Gemini never saw them.`
              : 'Nothing personal needed to be added.'}
          </p>

          <label className="small muted" htmlFor="reply-subject">Subject</label>
          <input
            id="reply-subject"
            className="reply-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            dir="auto"
          />
          <label className="small muted" htmlFor="reply-letter">Your reply (you can edit it)</label>
          <textarea
            id="reply-letter"
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            rows={10}
            dir="auto"
          />

          {!ready && (
            <p className="notice notice-warn small" role="status">
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
            {edited && (
              <p className="small warning-text">
                You changed the reply after it was written, so this translation shows the first version.
              </p>
            )}
            <p {...langProps}>{fillIn(state.draft.translation, state.allLabels, state.allowed)}</p>
          </details>

          <button className="link-button" onClick={() => setShowLabels(!showLabels)}>
            {showLabels ? 'Hide' : 'Show'} what Gemini got and wrote (before filling in)
          </button>
          {showLabels && (
            <>
              {state.masked && <SharedText text={`Your message as sent: ${state.masked}`} />}
              <SharedText text={state.draft.reply} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
