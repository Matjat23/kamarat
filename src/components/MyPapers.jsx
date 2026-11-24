// "My papers": every saved notice and every upcoming deadline in one place.
// Everything here is stored only in this browser. Deadlines and the worry
// level are worked out again each time, with the same rules as the
// explanation screen.
import { useState } from 'react'
import {
  listPapers,
  updatePaper,
  deletePaper,
  deleteAllPapers,
  upcomingDeadlines,
  paperActions,
} from '../papers'
import { languageProps } from '../explain'
import { SOURCES } from '../sources'
import { downloadDeadline } from '../calendar'
import { WORRY, assessWorry, daysUntil } from '../worry'
import { SharedText } from './ExplainStep'
import { CalendarIcon, CheckIcon, LockIcon, LandmarkIcon, ArrowIcon } from './Icons'

const KIND_WORDS = { MUST: 'You must', CAN: 'You can', UNCLEAR: 'Unclear' }

function shortDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysLeft(date) {
  const days = daysUntil(date)
  if (days < 0) return `${-days} day(s) ago`
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

function addToCalendar(paper, action) {
  downloadDeadline({
    title: action.title,
    date: action.info.date,
    details: `${action.explanation}\n\nFrom ${paper.sender}: "${action.quote}"\n\n${action.info.basis}\nMade with Kamarat. Always check the original notice.`,
  })
}

function DeadlineLine({ info }) {
  if (!info) return <span className="small muted">No deadline</span>
  if (!info.date) return <span className="small muted">{info.text}</span>
  return (
    <span className="small">
      <strong>By {shortDate(info.date)}</strong> <span className="muted">({daysLeft(info.date)}) {info.basis}</span>
      {info.unchecked && (
        <span className="warning-text"> Kamarat could not match this date to the quote. Check it in your notice.</span>
      )}
    </span>
  )
}

function Paper({ paper, isOpen, onToggleOpen, onChange, onError, onDelete }) {
  const [showText, setShowText] = useState(false)
  const actions = paperActions(paper)
  const assessed = assessWorry(paper.worry, actions)
  const worry = WORRY[assessed.level]
  const todo = actions.filter((a) => a.group !== 'CHECK')
  const toCheck = actions.filter((a) => a.group === 'CHECK')
  const needsReceived = actions.some((a) => a.info?.needs === 'received')
  const langProps = languageProps(paper.language)
  const pages = paper.pages.map((id) => SOURCES.find((s) => s.id === id)).filter(Boolean)

  function save(patch) {
    if (!updatePaper(paper.id, patch)) onError('Kamarat could not update My papers on this device.')
    onChange()
  }

  function toggleDone(index) {
    const done = new Set(paper.done)
    if (done.has(index)) done.delete(index)
    else done.add(index)
    save({ done: [...done] })
  }

  return (
    <article className="paper">
      <div className="paper-head">
        <span>
          <span className="eyebrow">Saved {shortDate(new Date(paper.savedAt))}</span>
          <strong>{paper.sender}</strong>
        </span>
        <span className={`worry-chip worry-${assessed.level}`}>{worry.short}</span>
      </div>
      <p className="small" {...langProps}>{paper.summary}</p>
      <div className="buttons">
        <button className="secondary small-btn" aria-expanded={isOpen} onClick={onToggleOpen}>
          {isOpen ? 'Close' : 'Open'}
        </button>
        <button className="ghost small-btn" onClick={onDelete}>Delete</button>
      </div>

      {isOpen && (
        <div className="paper-body">
          <div className={`worry worry-${assessed.level}`}>
            <strong className="worry-title">{worry.title}</strong>
            {assessed.reason && <p className="small" {...langProps}>{assessed.reason}</p>}
            {assessed.raised && <p className="small">{assessed.raised}</p>}
            {worry.help && <p className="small worry-help">{worry.help}</p>}
          </div>

          {needsReceived && (
            <div className="received">
              <label htmlFor={`received-${paper.id}`}>
                Some deadlines count from the day you received this notice. When did you get it?
              </label>
              <input
                id={`received-${paper.id}`}
                type="date"
                value={paper.receivedDate}
                onChange={(e) => save({ receivedDate: e.target.value })}
              />
            </div>
          )}
          {paper.receivedDate && !needsReceived && actions.some((a) => a.deadline.kind === 'AFTER_RECEIVING') && (
            <p className="small muted">
              You received it on {shortDate(new Date(`${paper.receivedDate}T00:00`))}.{' '}
              <button className="link-button" onClick={() => save({ receivedDate: '' })}>Change</button>
            </p>
          )}

          {todo.length > 0 && (
            <ul className="paper-actions">
              {todo.map((action) => (
                <li key={action.index} className={action.done ? 'action-done' : ''}>
                  <button
                    className={`done-toggle ${action.done ? 'is-done' : ''}`}
                    onClick={() => toggleDone(action.index)}
                    aria-pressed={action.done}
                    aria-label={action.done ? `Mark "${action.title}" as not done` : `Mark "${action.title}" as done`}
                  >
                    {action.done && <CheckIcon width={16} height={16} />}
                  </button>
                  <span className="paper-action-body">
                    <span className="eyebrow">{KIND_WORDS[action.group]}</span>
                    <h4 {...langProps}>{action.title}</h4>
                    <span className="small" {...langProps}>{action.explanation}</span>
                    <DeadlineLine info={action.info} />
                    {action.info?.date && !action.done && (
                      <button className="ghost small-btn" onClick={() => addToCalendar(paper, action)}>
                        <CalendarIcon width={16} height={16} /> Add to calendar
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {toCheck.length > 0 && (
            <div className="paper-check">
              <h4>Needs checking</h4>
              <p className="small muted">
                Kamarat could not find the sentence these are based on. Read your notice before acting on them.
              </p>
              <ul>
                {toCheck.map((action) => (
                  <li key={action.index} {...langProps}>{action.title}</li>
                ))}
              </ul>
            </div>
          )}

          {pages.length > 0 && (
            <div className="sources">
              {pages.map((page) => (
                <a key={page.id} className="source" href={page.url} target="_blank" rel="noopener noreferrer">
                  <span className="source-icon" aria-hidden="true"><LandmarkIcon /></span>
                  <span className="source-body">
                    <span className="eyebrow">{page.agency}</span>
                    <strong>{page.title}</strong>
                    <span className="small source-url">{new URL(page.url).hostname}</span>
                  </span>
                  <ArrowIcon className="source-arrow" />
                </a>
              ))}
            </div>
          )}

          <div className="buttons">
            <button className="link-button" aria-expanded={showText} onClick={() => setShowText(!showText)}>
              {showText ? 'Hide' : 'Show'} the text you approved
            </button>
          </div>
          {showText && <SharedText text={paper.shared} />}
        </div>
      )}
    </article>
  )
}

export default function MyPapers({ onNew }) {
  const [papers, setPapers] = useState(listPapers)
  const [openId, setOpenId] = useState(null)
  const [error, setError] = useState('')
  const refresh = () => setPapers(listPapers())
  const { dated, unknown } = upcomingDeadlines(papers)

  function remove(paper) {
    if (!window.confirm(`Delete "${paper.sender}" from My papers on this device?`)) return
    if (!deletePaper(paper.id)) setError('Kamarat could not delete this paper.')
    refresh()
  }

  function removeAll() {
    if (!window.confirm('Delete all saved papers from this device? This cannot be undone.')) return
    if (!deleteAllPapers()) setError('Kamarat could not delete your papers.')
    refresh()
  }

  function openPaper(id) {
    setOpenId(id)
    requestAnimationFrame(() =>
      document.getElementById(`paper-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Only on this device</span>
          <h2 tabIndex={-1} data-step-heading>My papers</h2>
        </div>
        <button className="primary" onClick={onNew}>Add a notice</button>
      </div>
      <p className="notice notice-ok small">
        <LockIcon width={16} height={16} /> Saved in this browser only. Kamarat keeps the explanation and the
        text you approved, never your hidden details. Use a device that only you use.
      </p>
      {error && <p className="notice notice-warn small" role="alert">{error}</p>}

      {papers.length === 0 ? (
        <div className="empty">
          <p><strong>Nothing saved yet.</strong></p>
          <p className="muted small">
            After Kamarat explains a notice, tap "Save to My papers" to keep it here with its deadlines.
          </p>
        </div>
      ) : (
        <>
          <div className="group">
            <div className="group-head">
              <span className="group-dot" aria-hidden="true" style={{ background: 'var(--terracotta)' }} />
              <h3>Coming up</h3>
              <span className="small muted">Open deadlines from all your papers.</span>
            </div>
            {dated.length === 0 && unknown.length === 0 ? (
              <p className="small muted">No open deadlines. Nice.</p>
            ) : (
              <ul className="upcoming">
                {dated.map(({ paper, action, date }) => (
                  <li key={`${paper.id}-${action.index}`}>
                    <span className="upcoming-date">
                      <strong>{shortDate(date)}</strong>
                      <span className="small muted">{daysLeft(date)}</span>
                    </span>
                    <span className="upcoming-body">
                      <strong {...languageProps(paper.language)}>{action.title}</strong>
                      <span className="small muted">{paper.sender}</span>
                      {action.info.unchecked && <span className="small warning-text">Check this date in your notice.</span>}
                    </span>
                    <button className="ghost small-btn" onClick={() => addToCalendar(paper, action)}>
                      <CalendarIcon width={16} height={16} /> Calendar
                    </button>
                  </li>
                ))}
                {unknown.map(({ paper, action }) => (
                  <li key={`${paper.id}-${action.index}`} className="upcoming-unknown">
                    <span className="upcoming-date">
                      <strong>Date not known</strong>
                    </span>
                    <span className="upcoming-body">
                      <strong {...languageProps(paper.language)}>{action.title}</strong>
                      <span className="small muted">{paper.sender} · {action.info.text}</span>
                    </span>
                    <button className="ghost small-btn" onClick={() => openPaper(paper.id)}>
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="group">
            <div className="group-head">
              <span className="group-dot dot-green" aria-hidden="true" />
              <h3>Your notices</h3>
            </div>
            {papers.map((paper) => (
              <div key={paper.id} id={`paper-${paper.id}`}>
                <Paper
                  paper={paper}
                  isOpen={openId === paper.id}
                  onToggleOpen={() => setOpenId(openId === paper.id ? null : paper.id)}
                  onChange={refresh}
                  onError={setError}
                  onDelete={() => remove(paper)}
                />
              </div>
            ))}
          </div>

          <button className="link-button" onClick={removeAll}>Delete everything on this device</button>
        </>
      )}
    </section>
  )
}
