// "Ask Kamarat": questions about moving to and living in the new country.
//
// - The question is checked on this device first: numbers and emails are
//   hidden, and Gemini Nano looks for names and other details when it is
//   available. When it is not, the device cannot spot names, so you always see
//   exactly what will be sent and choose to send it.
// - The country the answers are about is shown at the top and can be changed.
// - Answers name who can help, with a link only when it is an official site or
//   a well-known non-profit. Answers with numbers in them, and legal problems,
//   get a note to check with the official body or get free legal advice.
// - The chat is not saved anywhere. "New chat" starts again.
import { useId, useMemo, useRef, useState } from 'react'
import { askGuide, GUIDE_QUESTIONS, MAX_GUIDE_QUESTIONS } from '../guide'
import { loadMovePlan } from '../move'
import { maskNote } from '../reply'
import { detectWithAI } from '../privacy'
import { languageProps } from '../explain'
import { countryList } from '../countries'
import { detectorModel, checkOnDeviceModel } from '../firebase'
import { SharedText } from './Text'
import { t } from '../i18n'
import { CloudIcon, LandmarkIcon, ArrowIcon, CameraIcon, Dots } from './Icons'

const searchLink = (name) => `https://www.google.com/search?q=${encodeURIComponent(name)}`

function GuideAnswer({ turn, language, onAsk, onAddLetter }) {
  const langProps = languageProps(language)
  return (
    <>
      <p className="bubble-text" {...langProps}>{turn.answer}</p>

      {turn.legal && (
        <p className="notice notice-warn guide-legal">
          {t('This sounds like a legal question. Kamarat cannot give legal advice. Before you act, ask a free legal advice service or a lawyer.')}
        </p>
      )}
      {turn.hasNumbers && !turn.legal && (
        <p className="small muted">{t('Numbers like fees, dates and time limits can change. Check them on the official website.')}</p>
      )}

      {turn.contacts.length > 0 && (
        <div className="guide-contacts">
          <span className="quote-head">{t('Who can help')}</span>
          <ul>
            {turn.contacts.map((c) => (
              <li key={c.organisation}>
                {c.website ? (
                  <a className="bubble-page" href={`https://${c.website}`} target="_blank" rel="noopener noreferrer">
                    <LandmarkIcon width={16} height={16} />
                    <span>
                      <strong className="small">{c.organisation}</strong>
                      <span className="small muted" {...langProps}>{c.why}</span>
                      <span className="small">{c.website}</span>
                    </span>
                    <ArrowIcon width={16} height={16} />
                  </a>
                ) : (
                  <span className="guide-contact-plain">
                    <LandmarkIcon width={16} height={16} />
                    <span>
                      <strong className="small">{c.organisation}</strong>
                      <span className="small muted" {...langProps}>{c.why}</span>
                      <a className="small" href={searchLink(c.organisation)} target="_blank" rel="noopener noreferrer">
                        {t('Search for them')}
                      </a>
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <span className="small muted">{t('Phone numbers and opening hours are on their official website.')}</span>
        </div>
      )}

      {turn.aboutLetter && (
        <button className="secondary small-btn" onClick={onAddLetter}>
          <CameraIcon width={16} height={16} /> {t('Let Kamarat read the letter')}
        </button>
      )}

      {turn.followUps.length > 0 && (
        <div className="chips guide-followups">
          {turn.followUps.map((q) => (
            <button key={q} className="chip-button" onClick={() => onAsk(q)} {...langProps}>{q}</button>
          ))}
        </div>
      )}

      <div className="bubble-meta">
        <span className="badge badge-in_cloud"><CloudIcon width={14} height={14} /> {t('Answered in the cloud')}</span>
      </div>
    </>
  )
}

export default function AskGuide({ country, language, startQuestion, onAddLetter }) {
  const uid = useId()
  const countries = useMemo(() => countryList(), [])
  const plan = useMemo(() => loadMovePlan(), [])
  const [where, setWhere] = useState(plan?.to || country || '')
  const [question, setQuestion] = useState(startQuestion || '')
  const [turns, setTurns] = useState([])
  const [confirm, setConfirm] = useState(null)
  const [checking, setChecking] = useState(false)
  const nextId = useRef(1)
  // The move list's origin and reason only apply when the chat is about the
  // same country as the list.
  const planHere = plan && plan.to === where ? plan : null

  const busy = checking || turns.some((turn) => turn.status === 'loading')
  const left = MAX_GUIDE_QUESTIONS - turns.length
  const preview = question.trim() ? maskNote(question.trim(), [], {}).masked : ''

  async function send(text, fromInput = true) {
    const raw = text.trim()
    if (!raw || busy || left <= 0) return
    const base = maskNote(raw, [], {})
    let full = base
    let namesChecked = false
    if ((await checkOnDeviceModel()) === 'available') {
      setChecking(true)
      try {
        const aiItems = (await detectWithAI(detectorModel, raw)).items
        full = maskNote(raw, [], {}, aiItems)
        namesChecked = true
      } catch (err) {
        console.warn('On-device check of the question failed, pattern check only.', err)
      }
      setChecking(false)
    }
    // Without the on-device check nobody looked for names, so the person sees
    // exactly what will be sent and decides.
    if (!namesChecked || full.masked !== base.masked) {
      setConfirm({ masked: full.masked, namesChecked, fromInput })
      return
    }
    submit(full.masked, fromInput)
  }

  async function submit(masked, fromInput = true) {
    setConfirm(null)
    if (fromInput) setQuestion('')
    const id = nextId.current++
    const history = turns.filter((turn) => turn.status === 'done').map((turn) => ({ question: turn.question, answer: turn.answer }))
    setTurns((list) => [...list, { id, question: masked, status: 'loading', statusText: t('Thinking about your question...') }])
    const update = (patch) => setTurns((list) => list.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)))
    try {
      const answer = await askGuide({
        question: masked,
        history,
        country: where,
        plan: planHere,
        language,
        onStatus: (statusText) => update({ statusText: t(statusText) }),
      })
      update({ status: 'done', ...answer })
    } catch (err) {
      update({ status: 'error', error: err.message })
    }
  }

  function newChat() {
    setTurns([])
    setConfirm(null)
    setQuestion('')
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send(question)
    }
  }

  return (
    <div className="guide">
      <section className="move-head">
        <h1 className="flow-title" tabIndex={-1} data-step-heading>{t('Ask Kamarat')}</h1>
        <p className="lead">
          {t('Questions about moving to and living in a new country. Kamarat tells you who can help and where to find them.')}
        </p>
        <div className="move-field guide-where">
          <label htmlFor={`${uid}-where`}>{t('The answers are about')}</label>
          <select id={`${uid}-where`} value={where} onChange={(e) => setWhere(e.target.value)} disabled={busy}>
            <option value="">{t('Choose a country')}</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
      </section>

      <div className="move-sheet ask">
        {turns.length > 0 && (
          <ol className="chat" role="log" aria-live="polite">
            {turns.map((turn) => (
              <li key={turn.id} className="chat-turn">
                <div className="bubble bubble-you">
                  <span className="quote-head">{t('You asked · sent like this')}</span>
                  <SharedText text={turn.question} className="bubble-text" />
                </div>
                <div className="bubble bubble-kamarat">
                  {turn.status === 'loading' && <p className="small muted" role="status"><Dots /> {turn.statusText}</p>}
                  {turn.status === 'error' && <p className="small warning-text">{t('Kamarat could not answer:')} {t(turn.error)}.</p>}
                  {turn.status === 'done' && (
                    <GuideAnswer turn={turn} language={language} onAsk={(q) => send(q, false)} onAddLetter={onAddLetter} />
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {turns.length === 0 && !confirm && (
          <div className="chips" aria-label={t('Suggested questions')}>
            {GUIDE_QUESTIONS.map((q) => (
              <button key={q} className="chip-button" disabled={busy || !where} onClick={() => send(t(q), false)}>
                {t(q)}
              </button>
            ))}
          </div>
        )}

        {confirm ? (
          <div className="review-note review-final" role="status">
            <span className="quote-head">
              {confirm.namesChecked
                ? t('Kamarat found more personal details and hid them. This is exactly what will be sent:')
                : t('On this device Kamarat cannot spot names. Check that there are no names or other personal details, then send. This is exactly what will be sent:')}
            </span>
            <SharedText text={confirm.masked} className="review-note-text" />
            <div className="buttons">
              <button
                className="secondary"
                onClick={() => {
                  if (!confirm.fromInput) setQuestion(confirm.masked)
                  setConfirm(null)
                }}
              >
                {t('Edit question')}
              </button>
              <button className="primary" onClick={() => submit(confirm.masked, confirm.fromInput)}>{t('Send it')}</button>
            </div>
          </div>
        ) : left > 0 ? (
          <form
            className="ask-form"
            onSubmit={(e) => {
              e.preventDefault()
              send(question)
            }}
          >
            <label htmlFor={`${uid}-question`} className="small muted">{t('Your question, in any language')}</label>
            <textarea
              id={`${uid}-question`}
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              aria-describedby={`${uid}-help`}
              placeholder={t('For example: How do I register my address?')}
              dir="auto"
            />
            <p id={`${uid}-help`} className="small muted">
              {t('Kamarat hides numbers and emails on your device, and looks for names when your device can. Leave out names and anything else you would rather not share.')}
            </p>
            {preview && preview !== question.trim() && (
              <div className="review-note">
                <span className="quote-head">{t('Will be sent like this')}</span>
                <SharedText text={preview} className="review-note-text" />
              </div>
            )}
            <button className="primary" type="submit" disabled={busy || !question.trim() || !where}>
              {checking ? <span role="status"><Dots /> {t('Checking your question on your device...')}</span> : t('Ask')}
            </button>
          </form>
        ) : (
          <p className="small muted">{t('That is all the questions for this chat. Start a new chat to ask more.')}</p>
        )}

        {turns.length > 0 && (
          <button className="secondary guide-new" onClick={newChat} disabled={busy}>{t('New chat')}</button>
        )}
        <p className="small muted">{t('Kamarat is not a lawyer. Check important things with the official body.')}</p>
      </div>
    </div>
  )
}
