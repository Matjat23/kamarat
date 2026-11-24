// Step 3: send the approved text to cloud Gemini (only after a click),
// then show what the notice asks: Must do, Can do and Unclear.
import { useState } from 'react'
import { explainNotice, resolveDeadline, LANGUAGES } from '../explain'
import { downloadDeadline } from '../calendar'
import DraftReply from './DraftReply'
import { CalendarIcon, CloudIcon, DeviceIcon, ArrowIcon, LandmarkIcon, Dots } from './Icons'

const GROUPS = [
  { kind: 'MUST', title: 'You must', hint: 'The notice requires this.' },
  { kind: 'CAN', title: 'You can', hint: 'Allowed or offered, not required.' },
  { kind: 'UNCLEAR', title: 'Unclear', hint: 'Depends on something the notice does not say. Ask the sender if unsure.' },
]

// Shows the approved text with hidden details as redaction bars.
export function SharedText({ text }) {
  return (
    <div className="shared-text">
      {text.split(/(\[[A-Z]+_\d+\])/g).map((part, i) =>
        /^\[[A-Z]+_\d+\]$/.test(part) ? (
          <span key={i} className="redact" title={part}>
            <span className="redact-label">{part.slice(1, -1).replace('_', ' ')}</span>
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </div>
  )
}

function DateTile({ date }) {
  return (
    <div className="date-tile" aria-hidden="true">
      <span className="date-month">{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
      <span className="date-day">{date.getDate()}</span>
      <span className="date-weekday">{date.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
    </div>
  )
}

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
        <span className="deadline-text">
          <strong>
            By {info.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </strong>
          <span className="small muted">
            {info.basis}
            {info.businessNote && ' Weekends are skipped. Public holidays are not, so check if one falls in between.'}
          </span>
        </span>
        <button className="ghost small-btn" onClick={addToCalendar}>
          <CalendarIcon width={16} height={16} /> Add to calendar
        </button>
      </div>
    )
  }
  return (
    <div className="deadline deadline-open">
      <span>{info.text}</span>
      {info.needs === 'received' && (
        <button className="ghost small-btn" onClick={onNeedReceived}>
          Tell Kamarat when you got it
        </button>
      )}
    </div>
  )
}

function SourceBadge({ source }) {
  return source === 'in_cloud' ? (
    <span className="badge badge-in_cloud"><CloudIcon width={14} height={14} /> Explained in the cloud</span>
  ) : (
    <span className="badge badge-on_device"><DeviceIcon width={14} height={14} /> Explained on your device</span>
  )
}

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export default function ExplainStep({ shared, labelMap, details, onBack, onRestart }) {
  const [language, setLanguage] = useState('English')
  const [state, setState] = useState({ phase: 'ready' })
  const [receivedDate, setReceivedDate] = useState('')
  const [showPayload, setShowPayload] = useState(false)

  async function send() {
    setState({ phase: 'loading', status: 'Gemini is reading your notice...' })
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

  if (state.phase !== 'done') {
    const loading = state.phase === 'loading'
    return (
      <section className="card">
        <div className="card-head">
          <div>
            <span className="eyebrow">Step 3 of 3</span>
            <h2>Send for an explanation</h2>
          </div>
        </div>
        <p className="muted">
          Only the text below goes to cloud Gemini through Firebase. The black bars are
          the details you chose to keep on this device.
        </p>
        <SharedText text={shared} />
        <div className="action-bar row-between">
          <label className="language">
            <span className="small muted">Explain in</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={loading}>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <div className="buttons">
            <button className="secondary" onClick={onBack} disabled={loading}>
              Back
            </button>
            <button className="primary big" onClick={send} disabled={loading}>
              {loading ? <><Dots /> Working</> : <>Send and explain <ArrowIcon /></>}
            </button>
          </div>
        </div>
        {loading && <p className="small muted loading-line">{state.status}</p>}
        {state.phase === 'error' && (
          <p className="notice notice-warn">Something went wrong: {state.message}. Try again.</p>
        )}
      </section>
    )
  }

  const { result } = state
  const needsReceived = result.actions.some((a) => a.deadline?.kind === 'AFTER_RECEIVING')

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Your notice, explained</span>
          <h2>What this notice asks of you</h2>
        </div>
        <SourceBadge source={result.source} />
      </div>

      {result.note && <p className="notice notice-ok">{result.note}</p>}

      <div className="summary">
        <span className="sender-avatar" aria-hidden="true">{initials(result.sender)}</span>
        <div>
          <span className="eyebrow">From {result.sender}</span>
          <p className="summary-text">{result.summary}</p>
        </div>
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
              <span className="group-dot" aria-hidden="true" />
              <h3>{group.title}</h3>
              <span className="small muted">{group.hint}</span>
            </div>
            {items.map((action, i) => {
              const info = resolveDeadline(action.deadline, {
                noticeDate: result.noticeDate,
                receivedDate,
              })
              return (
                <article key={i} className="action">
                  <div className="action-main">
                    <h4>{action.title}</h4>
                    <p>{action.explanation}</p>
                    <Deadline
                      info={info}
                      action={action}
                      sender={result.sender}
                      onNeedReceived={focusReceived}
                    />
                    <blockquote className={action.quoteFound ? '' : 'quote-missing'}>
                      <span className="quote-head">
                        {action.quoteFound
                          ? 'From your notice'
                          : 'Kamarat could not find this exact sentence in your notice. Read the original before you act'}
                      </span>
                      <span>{action.quote}</span>
                    </blockquote>
                  </div>
                  {info?.date && <DateTile date={info.date} />}
                </article>
              )
            })}
          </div>
        )
      })}

      {result.pages.length > 0 && (
        <div className="group">
          <div className="group-head">
            <span className="group-dot dot-green" aria-hidden="true" />
            <h3>Official pages for this notice</h3>
            <span className="small muted">Only from Kamarat's checked list of government sources.</span>
          </div>
          <div className="sources">
            {result.pages.map(({ page, why }) => (
              <a key={page.id} className="source" href={page.url} target="_blank" rel="noopener noreferrer">
                <span className="source-icon" aria-hidden="true"><LandmarkIcon /></span>
                <span className="source-body">
                  <span className="eyebrow">{page.agency}</span>
                  <strong>{page.title}</strong>
                  <span className="small">{why}</span>
                  <span className="small source-url">{new URL(page.url).hostname}</span>
                </span>
                <ArrowIcon className="source-arrow" />
              </a>
            ))}
          </div>
        </div>
      )}

      <DraftReply shared={shared} labelMap={labelMap} details={details} language={language} />

      <button className="link-button" onClick={() => setShowPayload(!showPayload)}>
        {showPayload ? 'Hide' : 'Show'} exactly what was sent to Gemini
      </button>
      {showPayload && <SharedText text={shared} />}

      <div className="row-between end-row">
        <button className="secondary" onClick={() => setState({ phase: 'ready' })}>
          Explain again
        </button>
        <button className="primary" onClick={onRestart}>
          New notice
        </button>
      </div>
    </section>
  )
}
