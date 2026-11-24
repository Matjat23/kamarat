// "Ask Kamarat about this notice": a short chat under the next steps.
//
// - Your question is checked on this device first: details already hidden in
//   the notice get the same label, numbers and emails are hidden, and Gemini
//   Nano looks for names and other details. You see what will be sent.
// - Answers come only from the notice. Each one shows what it is based on, and
//   the code checks that quoted sentences are really in the notice.
// - When the notice does not say, Kamarat suggests asking the sender and can
//   start that reply for you.
// - The chat is not saved anywhere.
import { useId, useRef, useState } from 'react'
import { askAboutNotice, MAX_QUESTIONS, SUGGESTED_QUESTIONS } from '../ask'
import { maskNote } from '../reply'
import { detectWithAI } from '../privacy'
import { languageProps, LANGUAGES } from '../explain'
import { detectorModel, checkOnDeviceModel } from '../firebase'
import { speak, stopSpeaking, canSpeak } from '../speak'
import { SharedText, QuoteInNotice } from './Text'
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
          <span className="quote-head">From your letter</span>
          <span dir="auto">{turn.quote}</span>
          <button className="link-button" aria-expanded={showQuote} onClick={() => setShowQuote(!showQuote)}>
            {showQuote ? 'Hide' : 'Show in my letter'}
          </button>
          {showQuote && <QuoteInNotice shared={shared} quote={turn.quote} />}
        </blockquote>
      )}
      {turn.basis === 'NOTICE' && !turn.quoteFound && (
        <p className="small warning-text">
          Kamarat could not find the sentence this answer is based on in your letter. Check your letter before
          you rely on it.
        </p>
      )}
      {turn.basis === 'NOT_IN_NOTICE' && (
        <div className="bubble-open">
          <span className="quote-head">Your letter does not say</span>
          {turn.askSender && (
            <span className="small" {...langProps}>
              You could ask them: "{turn.askSender}"
            </span>
          )}
          <button className="secondary small-btn" onClick={() => onAskSender(turn.askSender || turn.question)}>
            <PenIcon width={14} height={14} /> Ask the sender
          </button>
        </div>
      )}
      {turn.page && (
        <a className="bubble-page" href={turn.page.url} target="_blank" rel="noopener noreferrer">
          <LandmarkIcon width={16} height={16} />
          <span>
            <span className="small muted">Official page about this · {turn.page.agency}</span>
            <strong className="small">{turn.page.title}</strong>
          </span>
          <ArrowIcon width={16} height={16} />
        </a>
      )}

      <div className="bubble-meta">
        {turn.source === 'on_device' ? (
          <span className="badge badge-on_device"><DeviceIcon width={14} height={14} /> Answered on your device</span>
        ) : (
          <span className="badge badge-in_cloud"><CloudIcon width={14} height={14} /> Answered in the cloud</span>
        )}
        {canSpeak() && (
          <button className="ghost small-btn" onClick={() => onListen(turn)} aria-pressed={speakingId === turn.id}>
            <SpeakerIcon width={14} height={14} /> {speakingId === turn.id ? 'Stop' : 'Listen'}
          </button>
        )}
      </div>
    </>
  )
}

export default function AskKamarat({ shared, labelMap, details, language, onAskSender }) {
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState([])
  const [confirm, setConfirm] = useState(null)
  const [checking, setChecking] = useState(false)
  const [speakingId, setSpeakingId] = useState(null)
  const [voiceMissing, setVoiceMissing] = useState(false)
  const nextId = useRef(1)
  const uid = useId()

  const busy = checking || turns.some((t) => t.status === 'loading')
  const left = MAX_QUESTIONS - turns.length
  const preview = question.trim() ? maskNote(question.trim(), details, labelMap).masked : ''

  // Step 1: check the question on this device. If Gemini Nano finds more than
  // the preview showed, show the final text before anything is sent.
  async function send(text, fromInput = true) {
    const raw = text.trim()
    if (!raw || busy || left <= 0) return
    const base = maskNote(raw, details, labelMap)
    let full = base
    if ((await checkOnDeviceModel()) === 'available') {
      setChecking(true)
      try {
        const aiItems = (await detectWithAI(detectorModel, raw)).items
        full = maskNote(raw, details, labelMap, aiItems)
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

  // Step 2: send the checked question.
  async function submit(masked, fromInput = true) {
    setConfirm(null)
    if (fromInput) setQuestion('')
    const id = nextId.current++
    const history = turns.filter((t) => t.status === 'done').map((t) => ({ question: t.question, answer: t.answer }))
    setTurns((list) => [...list, { id, question: masked, status: 'loading', statusText: 'Reading your letter again...' }])
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
      update({ status: 'error', error: err.message })
    }
  }

  async function listen(turn) {
    if (speakingId === turn.id) {
      stopSpeaking()
      setSpeakingId(null)
      return
    }
    const name = turn.note ? 'English' : language
    const code = LANGUAGES.find((l) => l.name === name)?.code ?? 'en'
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
      <p className="tab-intro">Ask anything about this letter. Answers come only from your letter, and Kamarat tells you when it does not say.</p>

      {turns.length > 0 && (
        <ol className="chat" role="log" aria-live="polite">
          {turns.map((turn) => (
            <li key={turn.id} className="chat-turn">
              <div className="bubble bubble-you">
                <span className="quote-head">You asked · sent like this</span>
                <SharedText text={turn.question} className="bubble-text" />
              </div>
              <div className="bubble bubble-kamarat">
                {turn.status === 'loading' && (
                  <p className="small muted" role="status"><Dots /> {turn.statusText}</p>
                )}
                {turn.status === 'error' && (
                  <p className="small warning-text">Kamarat could not answer: {turn.error}.</p>
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
        <p className="small muted">Your device has no offline voice for this language.</p>
      )}

      {left > 0 && !confirm && (
        <div className="chips" aria-label="Suggested questions">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button key={q} className="chip-button secondary" disabled={busy} onClick={() => send(q, false)}>
              {q}
            </button>
          ))}
        </div>
      )}

      {confirm ? (
        <div className="review-note review-final" role="status">
          <span className="quote-head">Kamarat found more personal details and hid them. This is exactly what will be sent:</span>
          <SharedText text={confirm.masked} className="review-note-text" />
          <div className="buttons">
            <button className="secondary" onClick={() => setConfirm(null)}>Edit question</button>
            <button className="primary" onClick={() => submit(confirm.masked)}>Send it</button>
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
          <label htmlFor={`${uid}-question`} className="small muted">Your question, in any language</label>
          <textarea
            id={`${uid}-question`}
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
            aria-describedby={`${uid}-help`}
            placeholder="For example: Do I need to send the originals?"
            dir="auto"
          />
          <p id={`${uid}-help`} className="small muted">
            Kamarat hides names and numbers on your device before sending. Leave out anything else you would
            rather not share. {left} of {MAX_QUESTIONS} questions left for this letter.
          </p>
          {preview && preview !== question.trim() && (
            <div className="review-note">
              <span className="quote-head">Will be sent like this</span>
              <SharedText text={preview} className="review-note-text" />
            </div>
          )}
          <button className="primary" type="submit" disabled={busy || !question.trim()}>
            {checking ? <span role="status"><Dots /> Checking your question on your device...</span> : 'Ask'}
          </button>
        </form>
      ) : (
        <p className="small muted">
          That's {MAX_QUESTIONS} questions for this letter. If something is still unclear, ask the sender.
        </p>
      )}
    </div>
  )
}
