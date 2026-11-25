// "Ask Kamarat": questions about moving to and living in the new country.
//
// - The question is checked on this device first: numbers and emails are
//   hidden, and Gemini Nano looks for names and other details when it is
//   available. You see what will be sent.
// - Answers name who can help, with a link only when it is a government site.
// - The chat is not saved anywhere.
import { useEffect, useId, useRef, useState } from 'react'
import { askGuide, GUIDE_QUESTIONS, MAX_GUIDE_QUESTIONS } from '../guide'
import { loadMovePlan } from '../move'
import { maskNote } from '../reply'
import { detectWithAI } from '../privacy'
import { languageProps } from '../explain'
import { countryName } from '../countries'
import { detectorModel, checkOnDeviceModel } from '../firebase'
import { SharedText } from './Text'
import { t } from '../i18n'
import { CloudIcon, LandmarkIcon, ArrowIcon, CameraIcon, Dots } from './Icons'

function GuideAnswer({ turn, language, onAsk, onAddLetter }) {
  const langProps = languageProps(language)
  return (
    <>
      <p className="bubble-text" {...langProps}>{turn.answer}</p>

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
  const [question, setQuestion] = useState(startQuestion || '')
  const [turns, setTurns] = useState([])
  const [confirm, setConfirm] = useState(null)
  const [checking, setChecking] = useState(false)
  const nextId = useRef(1)
  const plan = loadMovePlan()
  const where = plan?.to || country

  useEffect(() => {
    if (startQuestion) setQuestion(startQuestion)
  }, [startQuestion])

  const busy = checking || turns.some((turn) => turn.status === 'loading')
  const left = MAX_GUIDE_QUESTIONS - turns.length
  const preview = question.trim() ? maskNote(question.trim(), [], {}).masked : ''

  async function send(text, fromInput = true) {
    const raw = text.trim()
    if (!raw || busy || left <= 0) return
    const base = maskNote(raw, [], {})
    let full = base
    if ((await checkOnDeviceModel()) === 'available') {
      setChecking(true)
      try {
        const aiItems = (await detectWithAI(detectorModel, raw)).items
        full = maskNote(raw, [], {}, aiItems)
      } catch (err) {
        console.warn('On-device check of the question failed, pattern check only.', err)
      }
      setChecking(false)
    }
    if (full.masked !== base.masked) {
      setConfirm({ masked: full.masked })
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
        plan,
        language,
        onStatus: (statusText) => update({ statusText: t(statusText) }),
      })
      update({ status: 'done', ...answer })
    } catch (err) {
      update({ status: 'error', error: err.message })
    }
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
          {where
            ? t('Questions about moving to and living in {country}. Kamarat tells you who can help and where to find them.', { country: countryName(where) })
            : t('Questions about moving to and living in a new country. Kamarat tells you who can help and where to find them.')}
        </p>
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
              <button key={q} className="chip-button" disabled={busy} onClick={() => send(t(q), false)}>
                {t(q)}
              </button>
            ))}
          </div>
        )}

        {confirm ? (
          <div className="review-note review-final" role="status">
            <span className="quote-head">{t('Kamarat found more personal details and hid them. This is exactly what will be sent:')}</span>
            <SharedText text={confirm.masked} className="review-note-text" />
            <div className="buttons">
              <button className="secondary" onClick={() => setConfirm(null)}>{t('Edit question')}</button>
              <button className="primary" onClick={() => submit(confirm.masked)}>{t('Send it')}</button>
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
              {t('Kamarat hides names and numbers on your device before sending. Leave out anything else you would rather not share.')}
            </p>
            {preview && preview !== question.trim() && (
              <div className="review-note">
                <span className="quote-head">{t('Will be sent like this')}</span>
                <SharedText text={preview} className="review-note-text" />
              </div>
            )}
            <button className="primary" type="submit" disabled={busy || !question.trim()}>
              {checking ? <span role="status"><Dots /> {t('Checking your question on your device...')}</span> : t('Ask')}
            </button>
          </form>
        ) : (
          <p className="small muted">{t('That is all the questions for now. Open Ask Kamarat again to start a new chat.')}</p>
        )}
        <p className="small muted">{t('Kamarat is not a lawyer. Check important things with the official body.')}</p>
      </div>
    </div>
  )
}
