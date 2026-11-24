// Step 3: "Your next steps". The reviewed text is sent as soon as this step
// opens (the person already chose to send it on the previous screen). The result
// is a small workspace: the next deadline first, then a checklist of actions,
// each linked to the sentence in the notice it comes from, and a reply draft.
import { useEffect, useMemo, useRef, useState } from 'react'
import { explainNotice, resolveDeadline } from '../explain'
import { occurrences } from '../privacy'
import { downloadDeadline } from '../calendar'
import DraftReply from './DraftReply'
import {
  CalendarIcon,
  CloudIcon,
  DeviceIcon,
  ArrowIcon,
  LandmarkIcon,
  CheckIcon,
  PenIcon,
  Dots,
} from './Icons'

const GROUPS = [
  { kind: 'MUST', title: 'You must', hint: 'The notice requires this.' },
  { kind: 'CAN', title: 'You can', hint: 'Allowed or offered, not required.' },
  { kind: 'UNCLEAR', title: 'Unclear', hint: 'Depends on something the notice does not say. Ask the sender if unsure.' },
  { kind: 'CHECK', title: 'Needs checking', hint: 'Kamarat could not find the sentence these are based on. Read your notice before acting on them.' },
]

// Shows text with hidden details as black redaction bars.
export function SharedText({ text, className = 'shared-text', highlight }) {
  const parts = text.split(/(\[[A-Z]+_\d+\])/g)
  return (
    <div className={className}>
      {parts.map((part, i) =>
        /^\[[A-Z]+_\d+\]$/.test(part) ? (
          <span key={i} className="redact" title={part}>
            <span className="redact-label">{part.slice(1, -1).replace('_', ' ')}</span>
          </span>
        ) : (
          <span key={i}>{highlight ? highlight(part) : part}</span>
        ),
      )}
    </div>
  )
}

// A short piece of the notice around the quote, with the quote marked.
function QuoteInNotice({ shared, quote }) {
  const match = occurrences(shared, quote.replace(/[“”"«»]/g, '').replace(/[.…]+$/, ''))[0]
  if (!match) return <p className="small muted">Kamarat could not find this sentence in your notice.</p>
  const start = Math.max(0, shared.lastIndexOf('\n\n', match.start - 1) + 1)
  const endBreak = shared.indexOf('\n\n', match.end)
  const end = endBreak === -1 ? shared.length : endBreak
  const before = shared.slice(start, match.start)
  const inside = shared.slice(match.start, match.end)
  const after = shared.slice(match.end, end)
  return (
    <div className="in-notice">
      <span className="quote-head">In your notice</span>
      <SharedText text={before} className="in-notice-text" />
      <mark className="in-notice-mark"><SharedText text={inside} className="in-notice-text" /></mark>
      <SharedText text={after} className="in-notice-text" />
    </div>
  )
}

function DateTile({ date, size = '' }) {
  return (
    <div className={`date-tile ${size}`} aria-hidden="true">
      <span className="date-month">{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
      <span className="date-day">{date.getDate()}</span>
      <span className="date-weekday">{date.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
    </div>
  )
}

function daysUntil(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((date - today) / 86400000)
}

function whenText(date) {
  const days = daysUntil(date)
  if (days < 0) return `${-days} day(s) ago`
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

function longDate(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function addToCalendar(action, info, sender) {
  downloadDeadline({
    title: action.title,
    date: info.date,
    details: `${action.explanation}\n\nFrom ${sender}: "${action.quote}"\n\n${info.basis}\nMade with Kamarat. Always check the original notice.`,
  })
}

function Deadline({ info, action, sender, onNeedReceived }) {
  if (!info) return null
  if (info.date) {
    return (
      <div className="deadline">
        <span className="deadline-text">
          <strong>By {longDate(info.date)} <span className="when">({whenText(info.date)})</span></strong>
          <span className="small muted">
            {info.basis}
            {info.businessNote && ' Weekends are skipped. Public holidays are not, so check if one falls in between.'}
          </span>
        </span>
        <button className="ghost small-btn" onClick={() => addToCalendar(action, info, sender)}>
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

export default function ExplainStep({ shared, labelMap, details, language, onBack, onRestart }) {
  const [state, setState] = useState({ phase: 'loading', status: 'Gemini is reading your notice...' })
  const [receivedDate, setReceivedDate] = useState('')
  const [done, setDone] = useState(() => new Set())
  const [openQuote, setOpenQuote] = useState(null)
  const [showPayload, setShowPayload] = useState(false)
  const replyRef = useRef(null)
  const started = useRef(false)

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

  // The person chose to send on the previous screen, so start right away.
  useEffect(() => {
    if (started.current) return
    started.current = true
    send()
  }, [])

  const actions = useMemo(() => {
    if (state.phase !== 'done') return []
    const { result } = state
    return result.actions.map((action, index) => ({
      ...action,
      index,
      group: action.quoteFound ? action.kind : 'CHECK',
      info: resolveDeadline(action.deadline, { noticeDate: result.noticeDate, receivedDate }),
    }))
  }, [state, receivedDate])

  function toggleDone(index) {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function focusReceived() {
    document.getElementById('received-date')?.focus()
  }

  if (state.phase !== 'done') {
    return (
      <section className="card">
        <div className="card-head">
          <div>
            <span className="eyebrow">Step 3 of 3</span>
            <h2>Your next steps</h2>
          </div>
        </div>
        {state.phase === 'loading' ? (
          <>
            <p className="notice notice-ok" role="status">
              <Dots /> {state.status}
            </p>
            <div className="skeleton" aria-hidden="true">
              <span /><span /><span />
            </div>
          </>
        ) : (
          <>
            <p className="notice notice-warn" role="alert">
              Something went wrong: {state.message}.
            </p>
            <div className="buttons">
              <button className="secondary" onClick={onBack}>Back</button>
              <button className="primary" onClick={send}>Try again</button>
            </div>
          </>
        )}
      </section>
    )
  }

  const { result } = state
  const needsReceived = actions.some((a) => a.info?.needs === 'received')
  const dated = actions
    .filter((a) => a.info?.date && a.group !== 'CHECK' && !done.has(a.index))
    .sort((a, b) => a.info.date - b.info.date)
  const next = dated.find((a) => a.kind === 'MUST') ?? dated[0]
  const countable = actions.filter((a) => a.group !== 'CHECK')
  const doneCount = countable.filter((a) => done.has(a.index)).length

  return (
    <section className="card workspace">
      <div className="card-head">
        <div>
          <span className="eyebrow">Your next steps</span>
          <h2>Here is what to do</h2>
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

      {next && (
        <div className="next-up">
          <DateTile date={next.info.date} size="date-tile-big" />
          <div className="next-up-body">
            <span className="eyebrow">Next deadline · {whenText(next.info.date)}</span>
            <strong className="next-up-title">{next.title}</strong>
            <span className="small">By {longDate(next.info.date)}</span>
            <div className="buttons">
              <button className="primary small-btn" onClick={() => addToCalendar(next, next.info, result.sender)}>
                <CalendarIcon width={16} height={16} /> Add to calendar
              </button>
            </div>
          </div>
        </div>
      )}

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

      {countable.length > 0 && (
        <div className="progress-line" role="status">
          <div className="progress-track"><span style={{ width: `${(doneCount / countable.length) * 100}%` }} /></div>
          <span className="small muted">{doneCount} of {countable.length} done</span>
        </div>
      )}

      {GROUPS.map((group) => {
        const items = actions.filter((a) => a.group === group.kind)
        if (items.length === 0) return null
        return (
          <div key={group.kind} className={`group group-${group.kind}`}>
            <div className="group-head">
              <span className="group-dot" aria-hidden="true" />
              <h3>{group.title}</h3>
              <span className="small muted">{group.hint}</span>
            </div>
            {items.map((action) => {
              const isDone = done.has(action.index)
              return (
                <article key={action.index} className={`action ${isDone ? 'action-done' : ''}`}>
                  {group.kind !== 'CHECK' && (
                    <button
                      className={`done-toggle ${isDone ? 'is-done' : ''}`}
                      onClick={() => toggleDone(action.index)}
                      aria-pressed={isDone}
                      aria-label={isDone ? `Mark "${action.title}" as not done` : `Mark "${action.title}" as done`}
                    >
                      {isDone && <CheckIcon width={16} height={16} />}
                    </button>
                  )}
                  <div className="action-main">
                    <h4>{action.title}</h4>
                    <p>{action.explanation}</p>
                    {group.kind !== 'CHECK' && (
                      <Deadline
                        info={action.info}
                        action={action}
                        sender={result.sender}
                        onNeedReceived={focusReceived}
                      />
                    )}
                    <blockquote className={action.quoteFound ? '' : 'quote-missing'}>
                      <span className="quote-head">
                        {action.quoteFound ? 'From your notice' : 'Not found in your notice'}
                      </span>
                      <span>{action.quote}</span>
                    </blockquote>
                    <div className="action-links">
                      {action.quoteFound && (
                        <button
                          className="link-button"
                          aria-expanded={openQuote === action.index}
                          onClick={() => setOpenQuote(openQuote === action.index ? null : action.index)}
                        >
                          {openQuote === action.index ? 'Hide' : 'Show in my notice'}
                        </button>
                      )}
                      {group.kind === 'MUST' && (
                        <button
                          className="link-button"
                          onClick={() => replyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        >
                          <PenIcon width={14} height={14} /> Draft a reply
                        </button>
                      )}
                    </div>
                    {openQuote === action.index && <QuoteInNotice shared={shared} quote={action.quote} />}
                  </div>
                  {action.info?.date && group.kind !== 'CHECK' && <DateTile date={action.info.date} />}
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

      <div ref={replyRef} className="reply-anchor">
        <DraftReply shared={shared} labelMap={labelMap} details={details} language={language} />
      </div>

      <div className="end-row">
        <button className="link-button" onClick={() => setShowPayload(!showPayload)}>
          {showPayload ? 'Hide' : 'Show'} exactly what was sent to Gemini
        </button>
        {showPayload && <SharedText text={shared} />}
        <div className="row-between">
          <button className="secondary" onClick={send}>
            Explain again in {language}
          </button>
          <button className="link-button" onClick={onRestart}>
            Start with another notice
          </button>
        </div>
      </div>
    </section>
  )
}
