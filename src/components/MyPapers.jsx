// "My papers": every saved notice and every upcoming deadline in one place.
// Everything here is stored only in this browser.
import { useState } from 'react'
import { listPapers, updatePaper, deletePaper, deleteAllPapers, upcomingDeadlines } from '../papers'
import { downloadDeadline } from '../calendar'
import { CalendarIcon, CheckIcon, LockIcon } from './Icons'
import { WORRY } from './ExplainStep'

function shortDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysLeft(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((date - today) / 86400000)
  if (days < 0) return `${-days} day(s) ago`
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

export default function MyPapers({ onNew }) {
  const [papers, setPapers] = useState(listPapers)
  const [openId, setOpenId] = useState(null)
  const refresh = () => setPapers(listPapers())
  const upcoming = upcomingDeadlines(papers)

  function toggleDone(paper, index) {
    const done = new Set(paper.done ?? [])
    if (done.has(index)) done.delete(index)
    else done.add(index)
    updatePaper(paper.id, { done: [...done] })
    refresh()
  }

  function remove(paper) {
    if (!window.confirm(`Delete "${paper.sender}" from My papers on this device?`)) return
    deletePaper(paper.id)
    refresh()
  }

  function removeAll() {
    if (!window.confirm('Delete all saved papers from this device? This cannot be undone.')) return
    deleteAllPapers()
    refresh()
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
              <span className="small muted">All deadlines from all your papers.</span>
            </div>
            {upcoming.length === 0 ? (
              <p className="small muted">No open deadlines. Nice.</p>
            ) : (
              <ul className="upcoming">
                {upcoming.map(({ paper, action, index, date }) => (
                  <li key={`${paper.id}-${index}`}>
                    <span className="upcoming-date">
                      <strong>{shortDate(date)}</strong>
                      <span className="small muted">{daysLeft(date)}</span>
                    </span>
                    <span className="upcoming-body">
                      <strong>{action.title}</strong>
                      <span className="small muted">{paper.sender}</span>
                    </span>
                    <button
                      className="ghost small-btn"
                      onClick={() =>
                        downloadDeadline({
                          title: action.title,
                          date,
                          details: `${action.explanation}\n\nFrom ${paper.sender}: "${action.quote}"\nMade with Kamarat. Always check the original notice.`,
                        })
                      }
                    >
                      <CalendarIcon width={16} height={16} /> Calendar
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
            {papers.map((paper) => {
              const worry = WORRY[paper.worry?.level]
              const isOpen = openId === paper.id
              return (
                <article key={paper.id} className="paper">
                  <div className="paper-head">
                    <span>
                      <span className="eyebrow">Saved {shortDate(new Date(paper.savedAt))}</span>
                      <strong>{paper.sender}</strong>
                    </span>
                    {worry && <span className={`worry-chip worry-${paper.worry.level}`}>{worry.short}</span>}
                  </div>
                  <p className="small">{paper.summary}</p>
                  <div className="buttons">
                    <button className="secondary small-btn" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : paper.id)}>
                      {isOpen ? 'Close' : 'Open'}
                    </button>
                    <button className="ghost small-btn" onClick={() => remove(paper)}>Delete</button>
                  </div>
                  {isOpen && (
                    <ul className="paper-actions">
                      {paper.actions.map((action, index) => {
                        const done = paper.done?.includes(index)
                        return (
                          <li key={index} className={done ? 'action-done' : ''}>
                            <button
                              className={`done-toggle ${done ? 'is-done' : ''}`}
                              onClick={() => toggleDone(paper, index)}
                              aria-pressed={done}
                              aria-label={done ? `Mark "${action.title}" as not done` : `Mark "${action.title}" as done`}
                            >
                              {done && <CheckIcon width={16} height={16} />}
                            </button>
                            <span>
                              <h4>{action.title}</h4>
                              <span className="small muted">
                                {action.date ? `By ${shortDate(new Date(action.date))}` : action.when || 'No date'}
                              </span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </article>
              )
            })}
          </div>

          <button className="link-button" onClick={removeAll}>Delete everything on this device</button>
        </>
      )}
    </section>
  )
}
