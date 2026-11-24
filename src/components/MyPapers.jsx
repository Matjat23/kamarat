// "My papers": the letters you kept, stored only in this browser.
// The list shows what is coming up and every letter; a letter opens in the same
// letter screen as a new one. Deadlines and the worry level are worked out
// again each time, with the same rules.
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
import { WORRY, assessWorry, daysUntil } from '../worry'
import LetterView from './LetterView'
import { ArrowIcon, LockIcon } from './Icons'

function shortDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function whenText(date) {
  const days = daysUntil(date)
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} ago`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

export function SavedLetter({ id, onBack }) {
  const [paper, setPaper] = useState(() => listPapers().find((p) => p.id === id) ?? null)
  const [error, setError] = useState('')

  if (!paper) {
    return (
      <section className="card">
        <h1 className="flow-title" tabIndex={-1} data-step-heading>This letter is not here any more</h1>
        <p className="muted">It may have been deleted, or it was kept in another browser.</p>
        <button className="secondary" onClick={onBack}>Back to My papers</button>
      </section>
    )
  }

  function update(patch) {
    if (!updatePaper(paper.id, patch)) setError('Kamarat could not update My papers on this device.')
    setPaper(listPapers().find((p) => p.id === id) ?? null)
  }

  function remove() {
    if (!window.confirm(`Delete the letter from ${paper.sender} from this device?`)) return
    deletePaper(paper.id)
    onBack()
  }

  const letter = {
    sender: paper.sender,
    summary: paper.summary,
    worry: paper.worry,
    noticeDate: paper.noticeDate,
    language: paper.language,
    actions: paper.actions,
    pages: paper.pages.map((pid) => ({ page: SOURCES.find((s) => s.id === pid) })).filter((p) => p.page),
    shared: paper.shared,
    note: '',
  }

  return (
    <LetterView
      letter={letter}
      receivedDate={paper.receivedDate}
      onReceivedDate={(value) => update({ receivedDate: value })}
      done={paper.done}
      onToggleDone={(index) =>
        update({ done: paper.done.includes(index) ? paper.done.filter((i) => i !== index) : [...paper.done, index] })
      }
      save={error ? { saved: true, error } : null}
      onBack={onBack}
      backLabel="My papers"
      menu={[{ label: 'Delete this letter', onClick: remove }]}
    />
  )
}

export default function MyPapers({ onOpen, onNew }) {
  const [papers, setPapers] = useState(listPapers)
  const { dated, unknown } = upcomingDeadlines(papers)

  function removeAll() {
    if (!window.confirm('Delete all your kept letters from this device? This cannot be undone.')) return
    deleteAllPapers()
    setPapers(listPapers())
  }

  return (
    <div className="papers">
      <div className="papers-head">
        <div>
          <h1 className="flow-title" tabIndex={-1} data-step-heading>My papers</h1>
          <p className="small muted">
            <LockIcon width={14} height={14} /> Kept only in this browser, never your hidden details.
          </p>
        </div>
        <button className="primary" onClick={onNew}>New letter</button>
      </div>

      {papers.length === 0 ? (
        <section className="home-card empty">
          <p><strong>No letters kept yet.</strong></p>
          <p className="muted small">
            When Kamarat has explained a letter, tap "Keep in My papers" and it will be here with its deadlines.
          </p>
          <button className="secondary" onClick={onNew}>Explain a letter</button>
        </section>
      ) : (
        <>
          {(dated.length > 0 || unknown.length > 0) && (
            <section className="home-card">
              <h2 className="home-card-title">Coming up</h2>
              <ul className="coming-list">
                {dated.map(({ paper, action, date }) => (
                  <li key={`${paper.id}-${action.index}`}>
                    <button className="coming-item" onClick={() => onOpen(paper.id)}>
                      <span className={`coming-when ${daysUntil(date) <= 7 ? 'is-soon' : ''}`}>
                        {whenText(date)}
                        <span className="small muted">{shortDate(date)}</span>
                      </span>
                      <span className="coming-body">
                        <strong {...languageProps(paper.language)}>{action.title}</strong>
                        <span className="small muted">{paper.sender}</span>
                        {action.info.unchecked && <span className="small warning-text">Check this date in your letter</span>}
                      </span>
                      <ArrowIcon width={18} height={18} />
                    </button>
                  </li>
                ))}
                {unknown.map(({ paper, action }) => (
                  <li key={`${paper.id}-${action.index}`}>
                    <button className="coming-item" onClick={() => onOpen(paper.id)}>
                      <span className="coming-when">Date not known</span>
                      <span className="coming-body">
                        <strong {...languageProps(paper.language)}>{action.title}</strong>
                        <span className="small muted">{paper.sender} · {action.info.text}</span>
                      </span>
                      <ArrowIcon width={18} height={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="home-card">
            <h2 className="home-card-title">Your letters</h2>
            <ul className="paper-list">
              {papers.map((paper) => {
                const actions = paperActions(paper)
                const assessed = assessWorry(paper.worry, actions)
                const todo = actions.filter((a) => a.group !== 'CHECK')
                const doneCount = todo.filter((a) => a.done).length
                return (
                  <li key={paper.id}>
                    <button className="paper-item" onClick={() => onOpen(paper.id)}>
                      <span className="paper-item-top">
                        <strong>{paper.sender}</strong>
                        <span className={`worry-chip worry-${assessed.level}`}>{WORRY[assessed.level].short}</span>
                      </span>
                      <span className="small paper-summary" {...languageProps(paper.language)}>{paper.summary}</span>
                      <span className="small muted">
                        Kept {shortDate(new Date(paper.savedAt))}
                        {todo.length > 0 && ` · ${doneCount} of ${todo.length} steps done`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <button className="link-button" onClick={removeAll}>Delete everything on this device</button>
        </>
      )}
    </div>
  )
}
