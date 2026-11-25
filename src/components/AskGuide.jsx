// "Ask Katty": questions about moving to and living in the new country.
//
// - A question you type is checked on this device first: numbers and emails
//   are hidden, and Gemini Nano looks for names and other details when it is
//   available. Then you always see exactly what will be sent and choose to
//   send it. Katty's own suggested questions have nothing personal in them,
//   so they are sent with one tap.
// - The country the answers are about is shown at the top. The choice is
//   remembered, and changing it starts a new chat, so answers about two
//   countries are never mixed.
// - Answers name who can help, with a link only when it is an official site or
//   a well-known non-profit, and say which of the two it is. Otherwise there is
//   a web search link, clearly marked as a search.
// - Answers that had numbers in them get a note to check them. Legal problems
//   get a note about free legal advice, shown before the answer.
// - The chat is not saved anywhere. "New chat" starts again.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { askGuide, GUIDE_QUESTIONS, MAX_GUIDE_QUESTIONS } from '../guide'
import { loadMovePlan, MOVE_CHANGED } from '../move'
import { maskNote } from '../reply'
import { detectWithAI } from '../privacy'
import { languageProps } from '../explain'
import { countryList, countryName } from '../countries'
import { isOfficialDomain } from '../officialDomains'
import { detectorModel, checkOnDeviceModel } from '../firebase'
import { SharedText } from './Text'
import ReviewBeforeSend from './ReviewBeforeSend'
import { t, uiLanguageCode } from '../i18n'
import { CloudIcon, LandmarkIcon, ArrowIcon, CameraIcon, Dots } from './Icons'

const COUNTRY_KEY = 'kamarat.ask.country.v1'

function savedAskCountry() {
  try {
    const code = localStorage.getItem(COUNTRY_KEY) ?? ''
    return /^[A-Z]{2}$/.test(code) ? code : ''
  } catch {
    return ''
  }
}

function saveAskCountry(code) {
  try {
    localStorage.setItem(COUNTRY_KEY, code)
  } catch {
    // private mode: remembered until the page closes
  }
}

// A web search for the organisation in that country. Not checked by Katty,
// and the link says so.
const searchLink = (name, place) => `https://www.google.com/search?q=${encodeURIComponent(`${name} ${place}`)}`

function GuideAnswer({ turn, language, place, onAsk, onAddLetter }) {
  const langProps = languageProps(language)
  return (
    <>
      {turn.legal && (
        <p className="notice notice-warn guide-legal">
          {t('This sounds like a legal question. Katty cannot give legal advice. Before you act, ask a free legal advice service or a lawyer.')}
        </p>
      )}

      <p className="bubble-text" {...langProps}>{turn.answer}</p>

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
                      <span className="small">
                        {c.website} · {isOfficialDomain(c.website) ? t('Official website') : t('Help organisation')}
                      </span>
                    </span>
                    <ArrowIcon width={16} height={16} />
                  </a>
                ) : (
                  <span className="guide-contact-plain">
                    <LandmarkIcon width={16} height={16} />
                    <span>
                      <strong className="small">{c.organisation}</strong>
                      <span className="small muted" {...langProps}>{c.why}</span>
                      <a className="small" href={searchLink(c.organisation, place)} target="_blank" rel="noopener noreferrer">
                        {t('Search the web for them')}
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
          <CameraIcon width={16} height={16} /> {t('Let Katty read the letter')}
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

// compact: shown inside the floating chat panel, which has its own title.
export default function AskGuide({ country, language, startQuestion, startCountry, onAddLetter, compact = false }) {
  const uid = useId()
  // Country names follow the screen language, once its translation has loaded.
  const screenLanguage = uiLanguageCode()
  const countries = useMemo(() => countryList(), [screenLanguage])
  // The move list, kept up to date (the chat panel stays open while you change it).
  const [plan, setPlan] = useState(loadMovePlan)
  useEffect(() => {
    const onChange = () => setPlan(loadMovePlan())
    window.addEventListener(MOVE_CHANGED, onChange)
    return () => window.removeEventListener(MOVE_CHANGED, onChange)
  }, [])
  // A question about a step in your move list is about that list's country.
  const [where, setWhere] = useState(() => startCountry || savedAskCountry() || loadMovePlan()?.to || country || '')
  const [question, setQuestion] = useState(startQuestion || '')
  const [turns, setTurns] = useState([])
  const [review, setReview] = useState(null)
  const [checking, setChecking] = useState(false)
  const nextId = useRef(1)
  const input = useRef(null)
  // The move list's origin, citizenship and reason only apply when the chat is
  // about the same country as the list.
  const planHere = plan && plan.to === where ? plan : null

  const loading = turns.some((turn) => turn.status === 'loading')
  const busy = checking || loading
  const left = MAX_GUIDE_QUESTIONS - turns.length
  const preview = question.trim() ? maskNote(question.trim(), [], {}).masked : ''

  // A question you typed: checked on this device, then shown before sending.
  async function send(text) {
    const raw = text.trim()
    if (!raw || !where || busy || left <= 0) return
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
    setReview({ masked: full.masked, namesChecked, found: full.masked !== base.masked })
  }

  // Katty's own questions (suggestions and follow-ups) go straight away.
  function askSuggested(text) {
    if (!where || busy || left <= 0) return
    submit(text, false)
  }

  async function submit(masked, fromInput) {
    if (!where) return
    setReview(null)
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

  function retry(turn) {
    setTurns((list) => list.filter((other) => other.id !== turn.id))
    submit(turn.question, false)
  }

  function editQuestion() {
    setReview(null)
    requestAnimationFrame(() => input.current?.focus())
  }

  function newChat() {
    setTurns([])
    setReview(null)
    setQuestion('')
  }

  function changeWhere(code) {
    setWhere(code)
    saveAskCountry(code)
    // Answers about another country would be mixed into the new ones.
    if (turns.length > 0) newChat()
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send(question)
    }
  }

  const place = where ? countryName(where) : ''

  return (
    <div className={`guide ${compact ? 'guide-compact' : ''}`}>
      <section className="move-head">
        {!compact && (
          <>
            <h1 className="flow-title" tabIndex={-1} data-step-heading>{t('Ask Katty')}</h1>
            <p className="lead">
              {t('Questions about moving to and living in a new country. Katty tells you who can help and where to find them.')}
            </p>
          </>
        )}
        <div className="move-field guide-where">
          <label htmlFor={`${uid}-where`}>{t('The answers are about')}</label>
          <select
            id={`${uid}-where`}
            value={where}
            onChange={(e) => changeWhere(e.target.value)}
            disabled={busy}
            aria-describedby={turns.length > 0 ? `${uid}-where-help` : undefined}
          >
            <option value="">{t('Choose a country')}</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          {turns.length > 0 && (
            <span id={`${uid}-where-help`} className="small muted">{t('Choosing another country starts a new chat.')}</span>
          )}
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
                  {turn.status === 'error' && (
                    <>
                      <p className="small warning-text">{t('Katty could not answer:')} {t(turn.error)}.</p>
                      <button className="secondary small-btn" onClick={() => retry(turn)} disabled={busy}>{t('Try again')}</button>
                    </>
                  )}
                  {turn.status === 'done' && (
                    <GuideAnswer turn={turn} language={language} place={place} onAsk={askSuggested} onAddLetter={onAddLetter} />
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {turns.length === 0 && !review && (
          <div className="chips" aria-label={t('Suggested questions')}>
            {GUIDE_QUESTIONS.map((q) => (
              <button key={q} className="chip-button" disabled={busy || !where} onClick={() => askSuggested(t(q))}>
                {t(q)}
              </button>
            ))}
          </div>
        )}

        {review ? (
          <ReviewBeforeSend review={review} onEdit={editQuestion} onSend={() => submit(review.masked, true)} />
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
              ref={input}
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              aria-describedby={`${uid}-help`}
              placeholder={t('For example: How do I register my address?')}
              dir="auto"
              translate="no"
            />
            <p id={`${uid}-help`} className="small muted">
              {t('Katty hides numbers and emails on your device, and looks for names when your device can. You see your question before it is sent.')}
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
          <button className="secondary guide-new" onClick={newChat} disabled={checking}>{t('New chat')}</button>
        )}
        <p className="small muted">{t('Katty is not a lawyer. Check important things with the official body.')}</p>
      </div>
    </div>
  )
}
