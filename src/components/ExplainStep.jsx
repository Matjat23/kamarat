// Step 3: send the approved text to cloud Gemini (only after a click),
// then show what the notice asks: Must do, Can do and Unclear.
import { useState } from 'react'
import { explainNotice, resolveDeadline, formatDay, LANGUAGES } from '../explain'

const GROUPS = [
  { kind: 'MUST', title: 'You must', hint: 'The notice requires this.' },
  { kind: 'CAN', title: 'You can', hint: 'Allowed or offered, not required.' },
  { kind: 'UNCLEAR', title: 'Unclear', hint: 'Depends on something the notice does not say. Ask the sender if unsure.' },
]

function Deadline({ info, onNeedReceived }) {
  if (!info) return null
  if (info.date) {
    return (
      <div className="deadline">
        <strong>By {formatDay(info.date)}</strong>
        <span className="small muted">
          {info.basis}
          {info.businessNote && ' Weekends are skipped. Public holidays are not, so check if one falls in between.'}
        </span>
      </div>
    )
  }
  return (
    <div className="deadline deadline-open">
      <span>{info.text}</span>
      {info.needs === 'received' && (
        <button className="chip-button" onClick={onNeedReceived}>
          Tell Kamarat when you got it
        </button>
      )}
    </div>
  )
}

export default function ExplainStep({ shared, onBack, onRestart }) {
  const [language, setLanguage] = useState('English')
  const [state, setState] = useState({ phase: 'ready' })
  const [receivedDate, setReceivedDate] = useState('')
  const [showPayload, setShowPayload] = useState(false)

  async function send() {
    setState({ phase: 'loading' })
    try {
      const result = await explainNotice(shared, language)
      setState({ phase: 'done', result })
    } catch (err) {
      setState({ phase: 'error', message: err.message })
    }
  }

  function focusReceived() {
    document.getElementById('received-date')?.focus()
  }

  if (state.phase === 'ready' || state.phase === 'loading' || state.phase === 'error') {
    return (
      <section className="card">
        <h2>Send for an explanation</h2>
        <p className="muted">
          Only the text below goes to cloud Gemini through Firebase. Your hidden
          details stay on this device.
        </p>
        <pre className="shared-text">{shared}</pre>
        <div className="row-between">
          <label className="language">
            Explain in{' '}
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <div className="buttons">
            <button onClick={onBack} disabled={state.phase === 'loading'}>
              Back
            </button>
            <button className="primary" onClick={send} disabled={state.phase === 'loading'}>
              {state.phase === 'loading' ? 'Gemini is reading...' : 'Send and explain'}
            </button>
          </div>
        </div>
        {state.phase === 'error' && (
          <p className="notice notice-warn">Something went wrong: {state.message}. Nothing else was sent. Try again.</p>
        )}
      </section>
    )
  }

  const { result } = state
  const needsReceived = result.actions.some(
    (a) => a.deadline?.kind === 'AFTER_RECEIVING',
  )

  return (
    <section className="card">
      <div className="row-between">
        <h2>What this notice asks of you</h2>
        <span className={`badge badge-${result.source}`}>
          {result.source === 'in_cloud' ? 'In the cloud' : result.source}
        </span>
      </div>

      <div className="summary">
        <span className="small muted">From {result.sender}</span>
        <p>{result.summary}</p>
      </div>

      {needsReceived && (
        <div className="received">
          <label htmlFor="received-date">
            Some deadlines count from the day you received this notice. When did you get it?
          </label>
          <input
            id="received-date"
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
          />
        </div>
      )}

      {GROUPS.map((group) => {
        const items = result.actions.filter((a) => a.kind === group.kind)
        if (items.length === 0) return null
        return (
          <div key={group.kind} className={`group group-${group.kind}`}>
            <div className="group-head">
              <h3>{group.title}</h3>
              <span className="small muted">{group.hint}</span>
            </div>
            {items.map((action, i) => (
              <article key={i} className="action">
                <h4>{action.title}</h4>
                <p>{action.explanation}</p>
                <Deadline
                  info={resolveDeadline(action.deadline, {
                    noticeDate: result.noticeDate,
                    receivedDate,
                  })}
                  onNeedReceived={focusReceived}
                />
                <blockquote className={action.quoteFound ? '' : 'quote-missing'}>
                  <span className="small muted">
                    {action.quoteFound
                      ? 'From your notice:'
                      : 'Kamarat could not find this exact sentence in your notice. Read the original before you act:'}
                  </span>
                  <span>{action.quote}</span>
                </blockquote>
              </article>
            ))}
          </div>
        )
      })}

      <button className="link-button" onClick={() => setShowPayload(!showPayload)}>
        {showPayload ? 'Hide' : 'Show'} exactly what was sent to Gemini
      </button>
      {showPayload && <pre className="shared-text">{shared}</pre>}

      <div className="row-between">
        <button onClick={() => setState({ phase: 'ready' })}>Explain again</button>
        <button className="primary" onClick={onRestart}>
          New notice
        </button>
      </div>
    </section>
  )
}
