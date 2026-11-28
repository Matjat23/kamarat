// The Reply tab: cloud Gemini writes the reply with labels, and this device
// fills your real details back in.
// - Katty never guesses who you are: you choose your own name for the signature.
// - Your own message is checked on the device, and you see exactly what Gemini
//   will get before it is sent.
// - If you edit the reply afterwards, the translation is marked as out of date.
import { useEffect, useId, useMemo, useState } from 'react'
import { REPLY_INTENTS, draftReply, maskNote, fillIn, openItems } from '../reply'
import { detectWithAI } from '../privacy'
import { languageProps } from '../explain'
import { detectorModel, checkOnDeviceModel } from '../firebase'
import { ClipboardIcon, MailIcon, DeviceIcon, Dots } from './Icons'
import { SharedText } from './Text'
import { t } from '../i18n'

const WRITE_MYSELF = '__self'

// Labels of the given kinds, in the order they first appear in the notice.
function labelsOfType(labelMap, types, shared) {
  return Object.keys(labelMap)
    .filter((label) => types.some((type) => label.startsWith(`[${type}_`)))
    .sort((a, b) => shared.indexOf(a) - shared.indexOf(b))
}

export default function DraftReply({ shared, labelMap, details, language, prefill }) {
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
  const [appliedPrefill, setAppliedPrefill] = useState(null)
  const uid = useId()

  // "Ask the sender" in the chat starts a question reply with the suggested text.
  // It is checked on the device again like any other message.
  if (prefill && prefill !== appliedPrefill) {
    setAppliedPrefill(prefill)
    setIntent(prefill.intent)
    setNote(prefill.note)
    setState({ phase: 'idle' })
  }
  useEffect(() => {
    if (prefill) document.getElementById(`${uid}-note`)?.focus({ preventScroll: true })
  }, [prefill, uid])

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
      setState({ phase: 'loading', status: t('Checking your message on your device...') })
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
    setState({ phase: 'loading', status: t('Gemini is writing your reply...') })
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
    <div className="reply">
      <p className="tab-intro">{t('Katty writes the reply with labels, and your real name and case number are filled in on this device.')}</p>

      <fieldset className="intents">
        <legend className="visually-hidden">{t('What do you want to say?')}</legend>
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
            {t(o.label)}
          </label>
        ))}
      </fieldset>

      <div className="roles">
        <label>
          <span className="small muted">{t('Sign with your name')}</span>
          <select value={selfChoice} onChange={(e) => setSelfChoice(e.target.value)} translate="no">
            <option value="" disabled>
              {t('Choose your name...')}
            </option>
            {nameLabels.map((label) => (
              <option key={label} value={label}>
                {labelMap[label]}
              </option>
            ))}
            <option value={WRITE_MYSELF}>{t('I will write my name myself')}</option>
          </select>
        </label>
        <label>
          <span className="small muted">{t('Case number to mention')}</span>
          <select value={caseLabel} onChange={(e) => setCaseLabel(e.target.value)} translate="no">
            {caseLabels.map((label) => (
              <option key={label} value={label}>
                {labelMap[label]}
              </option>
            ))}
            <option value="">{t('None')}</option>
          </select>
        </label>
      </div>

      <label htmlFor={`${uid}-note`} className="small muted">
        {intent === 'question' ? t('Your question') : t('Your message (optional)')}
      </label>
      <textarea
        id={`${uid}-note`}
        translate="no"
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          if (state.phase === 'confirm') setState({ phase: 'idle' })
        }}
        rows={3}
        aria-describedby={`${uid}-note-help`}
        placeholder={
          intent === 'question'
            ? t('Your question, in your own words.')
            : t('For example which documents you attach, or why you need more time.')
        }
      />
      <p id={`${uid}-note-help`} className="small muted">
        {t('Avoid names and health details. Katty adds your name and case number for you, on this device.')}
      </p>
      {note.trim() && state.phase !== 'confirm' && (
        <div className="review-note">
          <span className="quote-head">{t('Preview · numbers and emails hidden')}</span>
          <SharedText text={preview.masked} className="review-note-text" />
        </div>
      )}

      {state.phase === 'confirm' ? (
        <div className="review-note review-final" role="status">
          <span className="quote-head">{t('Final check · this is exactly what Gemini gets from your message')}</span>
          <SharedText text={state.masked} className="review-note-text" />
          <span className="small muted">
            {t('If you see a name or anything private, edit your message. Otherwise send it.')}
          </span>
          <div className="buttons">
            <button className="secondary" onClick={() => setState({ phase: 'idle' })}>
              {t('Edit message')}
            </button>
            <button className="primary" onClick={() => write(state)}>
              {t('Send to Gemini and write the reply')}
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
              ? t('Choose your name first')
              : needsNote
                ? t('Write your question first')
                : state.phase === 'done'
                  ? t('Write it again')
                  : t('Write my reply')}
        </button>
      )}

      {state.phase === 'error' && (
        <p className="notice notice-warn" role="alert">{t('Could not write the reply:')} {state.message}. {t('Try again in a minute.')}</p>
      )}

      {state.phase === 'done' && (
        <div className="reply-result">
          <h4>{t('Draft ready. Check it before you send it.')}</h4>
          <p className="notice notice-ok small">
            <span className="badge badge-on_device"><DeviceIcon width={14} height={14} /> {t('Filled in on your device')}</span>
            {state.filled.length > 0
              ? t('Your personal details were added on this device. Gemini never saw them.')
              : t('Nothing personal needed to be added.')}
          </p>

          <label className="small muted" htmlFor={`${uid}-subject`}>{t('Subject')}</label>
          <input
            id={`${uid}-subject`}
            className="reply-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            dir="auto"
            translate="no"
          />
          <label className="small muted" htmlFor={`${uid}-letter`}>{t('Your reply (you can edit it)')}</label>
          <textarea
            id={`${uid}-letter`}
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            rows={10}
            dir="auto"
            translate="no"
          />

          {!ready && (
            <p className="notice notice-warn small" role="status">
              {open.fillIns.length > 0 &&
                `${t('Replace the [FILL IN: ...] parts with your own words.')} `}
              {open.unknownLabels.length > 0 &&
                t('Check {labels}: Katty did not fill these in on purpose. Replace or remove them.', {
                  labels: [...new Set(open.unknownLabels)].join(', '),
                })}
            </p>
          )}

          <div className="buttons">
            <button className="primary" onClick={copy}>
              <ClipboardIcon width={18} height={18} /> {copied ? t('Copied') : t('Copy reply')}
            </button>
            {ready ? (
              <a className="button-link" href={mailLink}>
                <MailIcon width={18} height={18} /> {t('Open in email')}
              </a>
            ) : (
              <span className="button-link disabled" aria-disabled="true">
                <MailIcon width={18} height={18} /> {t('Open in email (finish the gaps first)')}
              </span>
            )}
          </div>

          <details className="translation">
            <summary>{t('What it says in {language}', { language })}</summary>
            {edited && (
              <p className="small warning-text">
                {t('You changed the reply after it was written, so this translation shows the first version.')}
              </p>
            )}
            {/* Your real name and case number are filled in here. */}
            <p {...langProps} translate="no">{fillIn(state.draft.translation, state.allLabels, state.allowed)}</p>
          </details>

          <button className="link-button" onClick={() => setShowLabels(!showLabels)}>
            {showLabels ? t('Hide what Gemini got and wrote') : t('Show what Gemini got and wrote (before filling in)')}
          </button>
          {showLabels && (
            <>
              {state.masked && <SharedText text={`${t('Your message as sent:')} ${state.masked}`} />}
              <SharedText text={state.draft.reply} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
