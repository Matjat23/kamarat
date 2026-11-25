// "Ask Katty about this notice": a short chat under the next steps.
//
// - A question you type is checked on this device first: details already
//   hidden in the notice get the same label, numbers and emails are hidden,
//   and Gemini Nano looks for names and other details when it can. Then you
//   always see exactly what will be sent and choose to send it. The suggested
//   questions are Katty's own text, so they are sent with one tap.
// - Answers come only from the notice. Each one shows what it is based on, and
//   the code checks that quoted sentences are really in the notice.
// - When the notice does not say, Katty suggests asking the sender and can
//   start that reply for you.
// - The chat is not saved anywhere.
import { useId, useRef, useState } from 'react'
import { askAboutNotice, MAX_QUESTIONS, SUGGESTED_QUESTIONS } from '../ask'
import { maskNote } from '../reply'
import { detectWithAI } from '../privacy'
import { languageProps, languageCode } from '../explain'
import { detectorModel, checkOnDeviceModel } from '../firebase'
import { speak, stopSpeaking, canSpeak } from '../speak'
import { SharedText, QuoteInNotice } from './Text'
import ReviewBeforeSend from './ReviewBeforeSend'
import { friendlyError } from '../move'
import { t } from '../i18n'
import { CloudIcon, DeviceIcon, LandmarkIcon, ArrowIcon, PenIcon, SpeakerIcon, Dots } from './Icons'

function Answer({ turn, shared, language, speakingId, onListen, onAskSender }) {
  const [showQuote, setShowQuote] = useState(false)
  const langProps = languageProps(turn.note ? 'English' : language)
  return (
    <>
      <SharedText text={turn.answer} className="bubble-text" />
      {turn.note && <p className="small muted">{turn.note}</p>}

      {turn.basis === 'NOTICE' && turn.quoteFound && (
        <blockquote className="bubble-quote">
          <span className="quote-head">{t('From your letter')}</span>
          <span dir="auto">{turn.quote}</span>
          <button className="link-button" aria-expanded={showQuote} onClick={() => setShowQuote(!showQuote)}>
            {showQuote ? t('Hide') : t('Show in my letter')}
          </button>
          {showQuote && <QuoteInNotice shared={shared} quote={turn.quote} />}
        </blockquote>
      )}
      {turn.basis === 'NOTICE' && !turn.quoteFound && (
        <p className="small warning-text">
          {t('Katty could not find the sentence this answer is based on in your letter. Check your letter before you rely on it.')}
        </p>
      )}
      {turn.basis === 'NOT_IN_NOTICE' && (
        <div className="bubble-open">
          <span className="quote-head">{t('Your letter does not say')}</span>
          {turn.askSender && (
            <span className="small" {...langProps}>
              {t('You could ask them:')} "{turn.askSender}"
            </span>
          )}
          <button className="secondary small-btn" onClick={() => onAskSender(turn.askSender || turn.question)}>
            <PenIcon width={14} height={14} /> {t('Ask the sender')}
          </button>
        </div>
      )}
      {turn.page && (
        <a className="bubble-page" href={turn.page.url} target="_blank" rel="noopener noreferrer">
          <LandmarkIcon width={16} height={16} />
          <span>
            <span className="small muted">{t('Official page about this')} · {turn.page.agency}</span>
            <strong className="small">{turn.page.title}</strong>
          </span>
          <ArrowIcon width={16} height={16} />
        </a>
      )}

      <div className="bubble-meta">
        {turn.source === 'on_device' ? (
          <span className="badge badge-on_device"><DeviceIcon width={14} height={14} /> {t('Answered on your device')}</span>
        ) : (
          <span className="badge badge-in_cloud"><CloudIcon width={14} height={14} /> {t('Answered in the cloud')}</span>
        )}
        {canSpeak() && (
          <button className="ghost small-btn" onClick={() => onListen(turn)} aria-pressed={speakingId === turn.id}>
            <SpeakerIcon width={14} height={14} /> {speakingId === turn.id ? t('Stop') : t('Listen')}
          </button>
        )}
      </div>
    </>
  )
}

export default function AskKatty({ shared, labelMap, details, language, onAskSender }) {
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState([])
  const [review, setReview] = useState(null)
  const [checking, setChecking] = useState(false)
  const [speakingId, setSpeakingId] = useState(null)
  const [voiceMissing, setVoiceMissing] = useState(false)
  const nextId = useRef(1)
  const input = useRef(null)
  const uid = useId()

  const busy = checking || turns.some((t) => t.status === 'loading')
  const left = MAX_QUESTIONS - turns.length
  const preview = question.trim() ? maskNote(question.trim(), details, labelMap).masked : ''

  // Step 1: check the question you typed on this device, then show exactly
  // what will be sent.
  async function send(text) {
    const raw = text.trim()
    if (!raw || busy || left <= 0) return
    const base = maskNote(raw, details, labelMap)
    let full = base
    let namesChecked = false
    if ((await checkOnDeviceModel()) === 'available') {
      setChecking(true)
      try {
        const aiItems = (await detectWithAI(detectorModel, raw)).items
        full = maskNote(raw, details, labelMap, aiItems)
        namesChecked = true
      } catch (err) {
        console.warn('On-device check of the question failed, pattern check only.', err)
      }
      setChecking(false)
    }
    // Names from the letter are always hidden, but new names in the question
    // can only be found by Gemini Nano, and it can miss one. So the person
    // always sees the final text.
    setReview({ masked: full.masked, namesChecked, found: full.masked !== base.masked })
  }

  // A suggested question is Katty's own text: nothing personal to check.
  function askSuggested(text) {
    if (busy || left <= 0) return
    submit(text, false)
  }

  function editQuestion() {
    setReview(null)
    requestAnimationFrame(() => input.current?.focus())
  }

  // Step 2: send the checked question.
  async function submit(masked, fromInput) {
    setReview(null)
    if (fromInput) setQuestion('')
    const id = nextId.current++
    const history = turns.filter((t) => t.status === 'done').map((t) => ({ question: t.question, answer: t.answer }))
    setTurns((list) => [...list, { id, question: masked, status: 'loading', statusText: t('Reading your letter again...') }])
    const update = (patch) => setTurns((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    try {
      const answer = await askAboutNotice({
        shared,
        question: masked,
        history,
        language,
        onStatus: (statusText) => update({ statusText }),
      })
      update({ status: 'done', ...answer })
    } catch (err) {
      update({ status: 'error', error: friendlyError(err).message })
    }
  }

  async function listen(turn) {
    if (speakingId === turn.id) {
      stopSpeaking()
      setSpeakingId(null)
      return
    }
    const name = turn.note ? 'English' : language
    const code = languageCode(name)
    const parts = [turn.answer.replace(/\[([A-Z]+)_(\d+)\]/g, ''), turn.askSender]
    const started = await speak(parts, code, () => setSpeakingId(null))
    setVoiceMissing(!started)
    setSpeakingId(started ? turn.id : null)
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send(question)
    }
  }

  return (
    <div className="ask">
      <p className="tab-intro">{t('Ask anything about this letter. Answers come only from your letter, and Katty tells you when it does not say.')}</p>

      {turns.length > 0 && (
        <ol className="chat" role="log" aria-live="polite">
          {turns.map((turn) => (
            <li key={turn.id} className="chat-turn">
              <div className="bubble bubble-you">
                <span className="quote-head">{t('You asked · sent like this')}</span>
                <SharedText text={turn.question} className="bubble-text" />
              </div>
              <div className="bubble bubble-kamarat">
                {turn.status === 'loading' && (
                  <p className="small muted" role="status"><Dots /> {turn.statusText}</p>
                )}
                {turn.status === 'error' && (
                  <p className="small warning-text">{t('Katty could not answer:')} {t(turn.error)}.</p>
                )}
                {turn.status === 'done' && (
                  <Answer
                    turn={turn}
                    shared={shared}
                    language={language}
                    speakingId={speakingId}
                    onListen={listen}
                    onAskSender={onAskSender}
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {voiceMissing && (
        <p className="small muted">{t('Your device has no offline voice for this language.')}</p>
      )}

      {left > 0 && !review && (
        <div className="chips" aria-label={t('Suggested questions')}>
          {SUGGESTED_QUESTIONS.map((q) => (
            <button key={q} className="chip-button secondary" disabled={busy} onClick={() => askSuggested(t(q))}>
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
            placeholder={t('For example: Do I need to send the originals?')}
            dir="auto"
            translate="no"
          />
          <p id={`${uid}-help`} className="small muted">
            {t('Names and numbers from your letter are hidden on your device before sending. Katty looks for new names when your device can. You see your question before it is sent.')}{' '}
            {t('{left} of {max} questions left for this letter.', { left, max: MAX_QUESTIONS })}
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
        <p className="small muted">
          {t("That's {max} questions for this letter. If something is still unclear, ask the sender.", { max: MAX_QUESTIONS })}
        </p>
      )}
    </div>
  )
}
