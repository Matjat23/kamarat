// Step 3: send the approved text to cloud Gemini (only after a click),
// then show what the notice asks: Must do, Can do and Unclear.
import { useState } from 'react'
import { explainNotice, resolveDeadline, formatDay, LANGUAGES } from '../explain'
import { downloadDeadline } from '../calendar'

const GROUPS = [
  { kind: 'MUST', title: 'You must', hint: 'The notice requires this.' },
  { kind: 'CAN', title: 'You can', hint: 'Allowed or offered, not required.' },
  { kind: 'UNCLEAR', title: 'Unclear', hint: 'Depends on something the notice does not say. Ask the sender if unsure.' },
]

function Deadline({ info, action, sender, onNeedReceived }) {
  if (!info) return null
  if (info.date) {
    const addToCalendar = () =>
      downloadDeadline({
        title: action.title,
        date: info.date,
        details: `${action.explanation}\n\nFrom ${sender}: "${action.quote}"\n\n${info.basis}\nMade with Kamarat. Always check the original notice.`,
      })
    return (
      <div className="deadline">
        <div className="row-between">
          <strong>By {formatDay(info.date)}</strong>
          <button className="chip-button" onClick={addToCalendar}>
            Add to calendar
          </button>
        </div>
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
    setState({ phase: 'loading', status: 'Gemini is reading...' })
    try {
      const result = await explainNotice(shared, language, (status) =>
        setState({ phase: 'loading', status }),
      )
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
        <div className="action-bar row-between">
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
              {state.phase === 'loading' ? 'Working...' : 'Send and explain'}
            </button>
          </div>
        </div>
        {state.phase === 'loading' && <p className="small muted">{state.status}</p>}
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
          {result.source === 'in_cloud' ? 'In the cloud' : 'On your device'}
        </span>
      </div>

      {result.note && <p className="notice notice-ok">{result.note}</p>}

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
                  action={action}
                  sender={result.sender}
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

      {result.pages.length > 0 && (
        <div className="group">
          <div className="group-head">
            <h3>Official pages for this notice</h3>
            <span className="small muted">Only from Kamarat's checked list of government sources.</span>
          </div>
          {result.pages.map(({ page, why }) => (
            <a
              key={page.id}
              className="source"
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="small muted">{page.agency}</span>
              <strong>{page.title}</strong>
              <span className="small">{why}</span>
              <span className="small source-url">{new URL(page.url).hostname}</span>
            </a>
          ))}
        </div>
      )}

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
