// "My papers": the letters you kept, stored only in this browser.
// The list shows what is coming up and every letter; a letter opens in the same
// letter screen as a new one. Deadlines and the worry level are worked out
// again each time, with the same rules.
import { useEffect, useState } from 'react'
import {
  listPapers,
  updatePaper,
  deletePaper,
  deleteAllPapers,
  upcomingDeadlines,
  paperActions,
  explanationForPaper,
  PAPERS_CHANGED,
} from '../papers'
import { languageProps, explainNotice, explainedIn } from '../explain'
import { SOURCES } from '../sources'
import { WORRY, assessWorry, daysUntil, whenText, closeness } from '../worry'
import { t } from '../i18n'
import { shortDateWithYear } from '../dates'
import { downloadDeadlines, deadlineDetails } from '../calendar'
import LetterView from './LetterView'
import { ArrowIcon, CalendarIcon, LockIcon } from './Icons'

export function SavedLetter({ id, language, country, onBack }) {
  const [paper, setPaper] = useState(() => listPapers().find((p) => p.id === id) ?? null)
  const [error, setError] = useState('')
  const [explaining, setExplaining] = useState(false)

  // Follow changes made elsewhere, for example on the open letter.
  useEffect(() => {
    const sync = () => setPaper(listPapers().find((p) => p.id === id) ?? null)
    window.addEventListener(PAPERS_CHANGED, sync)
    return () => window.removeEventListener(PAPERS_CHANGED, sync)
  }, [id])

  if (!paper) {
    return (
      <section className="card">
        <h1 className="flow-title" tabIndex={-1} data-step-heading>{t('This letter is not here any more')}</h1>
        <p className="muted">{t('It may have been deleted, or it was kept in another browser.')}</p>
        <button className="secondary" onClick={onBack}>{t('Back to My papers')}</button>
      </section>
    )
  }

  function update(patch) {
    if (!updatePaper(paper.id, patch)) setError(t('Katty could not update My papers on this device.'))
    setPaper(listPapers().find((p) => p.id === id) ?? null)
  }

  // Explains the kept text again, for example in another language. The steps
  // can change, so the ticks start over.
  async function explainAgain() {
    setExplaining(true)
    setError('')
    try {
      const result = await explainNotice(paper.shared, language, undefined, paper.country || country)
      update({ ...explanationForPaper(result), language: explainedIn(result, language), done: [] })
    } catch (err) {
      setError(`${t('Katty could not explain it again:')} ${err.message}.`)
    }
    setExplaining(false)
  }

  function remove() {
    if (!window.confirm(t('Delete the letter from {sender} from this device?', { sender: paper.sender }))) return
    deletePaper(paper.id)
    onBack()
  }

  const letter = {
    sender: paper.sender,
    summary: paper.summary,
    worry: paper.worry,
    noticeDate: paper.noticeDate,
    country: paper.country,
    language: paper.language,
    actions: paper.actions,
    pages: paper.pages.map((pid) => ({ page: SOURCES.find((s) => s.id === pid) })).filter((p) => p.page),
    sites: paper.sites,
    shared: paper.shared,
    note: '',
    pagesMissing: paper.pagesMissing,
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
      backLabel={t('My papers')}
      currentLanguage={language}
      onExplainAgain={explainAgain}
      explaining={explaining}
      menu={[
        { label: t('Explain it again in {language}', { language }), onClick: explainAgain },
        { label: t('Delete this letter'), onClick: remove },
      ]}
    />
  )
}

export default function MyPapers({ onOpen, onNew }) {
  const [papers, setPapers] = useState(listPapers)
  const { dated, unknown } = upcomingDeadlines(papers)

  function removeAll() {
    if (!window.confirm(t('Delete all your kept letters from this device? This cannot be undone.'))) return
    deleteAllPapers()
    setPapers(listPapers())
  }

  return (
    <div className="papers">
      <div className="papers-head">
        <div>
          <h1 className="flow-title" tabIndex={-1} data-step-heading>{t('My papers')}</h1>
          <p className="small muted">
            <LockIcon width={14} height={14} /> {t('Kept only in this browser, never your hidden details.')}
          </p>
        </div>
        <button className="primary" onClick={onNew}>{t('New letter')}</button>
      </div>

      {papers.length === 0 ? (
        <section className="home-card empty">
          <p><strong>{t('No letters kept yet.')}</strong></p>
          <p className="muted small">
            {t('When Katty has explained a letter, tap "Keep in My papers" and it will be here with its deadlines.')}
          </p>
          <button className="secondary" onClick={onNew}>{t('Explain a letter')}</button>
        </section>
      ) : (
        <>
          {(dated.length > 0 || unknown.length > 0) && (
            <section className="home-card">
              <h2 className="home-card-title">{t('Coming up')}</h2>
              <ul className="coming-list">
                {dated.map(({ paper, action, date }) => (
                  <li key={`${paper.id}-${action.index}`}>
                    <button className={`coming-item ${closeness(date)}`} onClick={() => onOpen(paper.id)}>
                      <span className={`coming-when ${daysUntil(date) < 7 ? 'is-soon' : ''}`}>
                        {whenText(date)}
                        <span className="small muted">{shortDateWithYear(date)}</span>
                      </span>
                      <span className="coming-body">
                        <strong {...languageProps(paper.language)}>{action.title}</strong>
                        <span className="small muted">{paper.sender}</span>
                        {action.info.unchecked && <span className="small warning-text">{t('Check this date in your letter.')}</span>}
                      </span>
                      <ArrowIcon width={18} height={18} />
                    </button>
                  </li>
                ))}
                {unknown.map(({ paper, action }) => (
                  <li key={`${paper.id}-${action.index}`}>
                    <button className="coming-item" onClick={() => onOpen(paper.id)}>
                      <span className="coming-when">{t('Date not known')}</span>
                      <span className="coming-body">
                        <strong {...languageProps(paper.language)}>{action.title}</strong>
                        <span className="small muted">{paper.sender} · {action.info.text}</span>
                      </span>
                      <ArrowIcon width={18} height={18} />
                    </button>
                  </li>
                ))}
              </ul>
              {dated.length > 1 && (
                <button
                  className="secondary"
                  onClick={() =>
                    downloadDeadlines(
                      dated.map(({ paper, action, date }) => ({ title: action.title, date, details: deadlineDetails(action, paper.sender) })),
                    )
                  }
                >
                  <CalendarIcon width={18} height={18} /> {t('Add all {count} dates to my calendar', { count: dated.length })}
                </button>
              )}
            </section>
          )}

          <section className="home-card">
            <h2 className="home-card-title">{t('Your letters')}</h2>
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
                        {t('Kept {date}', { date: shortDateWithYear(new Date(paper.savedAt)) })}
                        {todo.length > 0 && ` · ${t('{done} of {total} done', { done: doneCount, total: todo.length })}`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <button className="link-button" onClick={removeAll}>{t('Delete everything on this device')}</button>
        </>
      )}
    </div>
  )
}
