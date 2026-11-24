// The letter screen: one answer card on top, then four tabs.
//   Steps  - what to do, as a checklist. Tap a step for the details.
//   Ask    - follow-up questions about this letter.
//   Reply  - draft a reply to the sender.
//   Letter - the text that was sent, with word help.
// Used for a letter that was just explained and for a letter from My papers.
import { useId, useMemo, useRef, useState } from 'react'
import { languageProps, LANGUAGES } from '../explain'
import { prepareActions } from '../papers'
import { WORRY, assessWorry, daysUntil } from '../worry'
import { downloadDeadline } from '../calendar'
import { speak, stopSpeaking, canSpeak, spokenPhrases, spokenDate } from '../speak'
import AskKamarat from './AskKamarat'
import DraftReply from './DraftReply'
import LetterText from './LetterText'
import {
  ArrowIcon,
  CalendarIcon,
  CheckIcon,
  CloudIcon,
  DeviceIcon,
  LandmarkIcon,
  PenIcon,
  SpeakerIcon,
  LockIcon,
} from './Icons'

const TABS = [
  { id: 'steps', label: 'Steps' },
  { id: 'ask', label: 'Ask' },
  { id: 'reply', label: 'Reply' },
  { id: 'letter', label: 'Letter' },
]

const GROUPS = [
  { kind: 'MUST', title: 'You must' },
  { kind: 'CAN', title: 'You can' },
  { kind: 'UNCLEAR', title: 'Not clear yet' },
]

function shortDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function longDate(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function whenText(date) {
  const days = daysUntil(date)
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} ago`
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function addToCalendar(action, sender) {
  downloadDeadline({
    title: action.title,
    date: action.info.date,
    details: `${action.explanation}\n\nFrom ${sender}: "${action.quote}"\n\n${action.info.basis}\nMade with Kamarat. Always check the original letter.`,
  })
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

function DateChip({ info, done }) {
  if (!info) return null
  if (!info.date) return <span className="date-chip chip-unknown">Date not known</span>
  const days = daysUntil(info.date)
  const tone = done ? '' : days < 0 ? 'chip-late' : days <= 7 ? 'chip-soon' : ''
  return <span className={`date-chip ${tone}`}>{shortDate(info.date)}</span>
}

function StepRow({ action, sender, langProps, open, onOpen, onToggleDone, onShowInLetter, onReply, onAskDate }) {
  const { info } = action
  return (
    <li className={`step-row ${action.done ? 'is-done' : ''}`}>
      <div className="step-line">
        <button
          className={`done-toggle ${action.done ? 'is-done' : ''}`}
          onClick={() => onToggleDone(action.index)}
          aria-pressed={action.done}
          aria-label={action.done ? `Mark "${action.title}" as not done` : `Mark "${action.title}" as done`}
        >
          {action.done && <CheckIcon width={16} height={16} />}
        </button>
        <button className="step-main" aria-expanded={open} onClick={onOpen}>
          <span className="step-title" {...langProps}>{action.title}</span>
          <DateChip info={info} done={action.done} />
          <span className={`chevron ${open ? 'is-open' : ''}`} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="step-detail">
          <p {...langProps}>{action.explanation}</p>
          {info?.date && (
            <p className="small">
              <strong>By {longDate(info.date)}</strong> ({whenText(info.date)}). <span className="muted">{info.basis}</span>
              {info.businessNote && (
                <span className="muted"> Weekends are skipped. Public holidays are not, so check if one falls in between.</span>
              )}
            </p>
          )}
          {info?.unchecked && (
            <p className="small warning-text">Kamarat could not match this date to your letter. Check it before you rely on it.</p>
          )}
          {info && !info.date && <p className="small muted">{info.text}</p>}
          <div className="step-links">
            <button className="link-button" onClick={() => onShowInLetter(action.quote)}>From your letter</button>
            {info?.needs === 'received' && (
              <button className="link-button" onClick={onAskDate}>Add the day you got it</button>
            )}
            {info?.date && (
              <button className="link-button" onClick={() => addToCalendar(action, sender)}>
                <CalendarIcon width={14} height={14} /> Add to calendar
              </button>
            )}
            {action.group === 'MUST' && (
              <button className="link-button" onClick={onReply}>
                <PenIcon width={14} height={14} /> Draft a reply
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

export default function LetterView({
  letter,
  receivedDate,
  onReceivedDate,
  done,
  onToggleDone,
  labelMap = {},
  details = [],
  save,
  onBack,
  backLabel,
  menu = [],
}) {
  const [tab, setTab] = useState('steps')
  const [openStep, setOpenStep] = useState(null)
  const [highlight, setHighlight] = useState(null)
  const [replyPrefill, setReplyPrefill] = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const [voiceMissing, setVoiceMissing] = useState(false)
  const tabsRef = useRef(null)
  // Unique ids, because a kept letter and a new one can be on the page at once.
  const uid = useId()
  const receivedRef = useRef(null)

  const langProps = languageProps(letter.language)
  const actions = useMemo(
    () => prepareActions(letter.actions, { noticeDate: letter.noticeDate, receivedDate, done }),
    [letter, receivedDate, done],
  )
  const assessed = assessWorry(letter.worry, actions)
  const worry = WORRY[assessed.level]

  const todo = actions.filter((a) => a.group !== 'CHECK')
  const toCheck = actions.filter((a) => a.group === 'CHECK')
  const next = todo.filter((a) => a.info?.date && !a.done).sort((a, b) => a.info.date - b.info.date)[0]
  const unknownDates = todo.filter((a) => !a.done && a.info && !a.info.date).length
  const needsReceived = actions.some((a) => a.info?.needs === 'received')
  const doneCount = todo.filter((a) => a.done).length

  function openTab(id) {
    setTab(id)
    requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  // The letter tab scrolls to the highlighted sentence itself.
  function showInLetter(quote) {
    setHighlight({ quote, at: Date.now() })
    setTab('letter')
  }

  function reply(prefill) {
    if (prefill) setReplyPrefill({ ...prefill, id: Date.now() })
    openTab('reply')
  }

  function onTabKey(event) {
    const index = TABS.findIndex((t) => t.id === tab)
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const nextTab = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
      setTab(nextTab.id)
      document.getElementById(`${uid}-tab-${nextTab.id}`)?.focus()
    }
  }

  // Reads the answer aloud with an on-device voice. Fixed sentences are only
  // spoken in languages Kamarat has them in.
  async function listen() {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    const code = LANGUAGES.find((l) => l.name === letter.language)?.code ?? 'en'
    const phrases = spokenPhrases(code)
    const parts = []
    if (code === 'en') parts.push(worry.title, assessed.raised)
    parts.push(letter.worry?.reason, letter.summary)
    for (const a of todo) {
      if (a.done) continue
      parts.push(`${a.title}. ${a.explanation}`)
      if (a.info?.date && (!a.info.unchecked || phrases)) {
        const when = spokenDate(a.info.date, code)
        parts.push(phrases ? phrases.by(when) : when)
        if (a.info.unchecked && phrases) parts.push(phrases.check)
      } else if (a.info && phrases) {
        parts.push(phrases.unknown)
      }
    }
    const started = await speak(parts, code, () => setSpeaking(false))
    setVoiceMissing(!started)
    setSpeaking(started)
  }

  return (
    <article className="letter-screen">
      <div className="letter-bar">
        <button className="ghost back-button" onClick={onBack}>
          <ArrowIcon className="flip" width={18} height={18} /> {backLabel}
        </button>
        <span className="letter-from">
          <span className="sender-avatar" aria-hidden="true">{initials(letter.sender)}</span>
          <span>
            <span className="small muted">From</span> <strong>{letter.sender}</strong>
          </span>
        </span>
        {menu.length > 0 && (
          <details className="more-menu">
            <summary aria-label="More options">More</summary>
            <div className="more-list">
              {menu.map((item) => (
                <button key={item.label} className="ghost" onClick={item.onClick}>{item.label}</button>
              ))}
            </div>
          </details>
        )}
      </div>

      <section className={`answer-card worry-${assessed.level}`}>
        <span className={`worry-chip worry-${assessed.level}`}>{worry.short}</span>
        <h1 className="answer-title" tabIndex={-1} data-step-heading>{worry.title}</h1>
        <p className="answer-summary" {...langProps}>{letter.summary}</p>
        {assessed.reason && <p className="small muted" {...langProps}>{assessed.reason}</p>}
        {assessed.raised && <p className="small">{assessed.raised}</p>}
        {worry.help && <p className="small worry-help">{worry.help}</p>}
        {letter.note && <p className="small muted">{letter.note}</p>}

        {next && (
          <div className="answer-next">
            <DateTile date={next.info.date} />
            <div className="answer-next-body">
              <span className="eyebrow">Next · {whenText(next.info.date)}</span>
              <strong {...langProps}>{next.title}</strong>
              <span className="small muted">By {longDate(next.info.date)}</span>
              {next.info.unchecked && <span className="small warning-text">Check this date in your letter.</span>}
              {unknownDates > 0 && (
                <span className="small warning-text">
                  {unknownDates === 1 ? 'One more deadline is' : `${unknownDates} more deadlines are`} not known yet and
                  could come first.
                </span>
              )}
            </div>
            <button className="secondary small-btn" onClick={() => addToCalendar(next, letter.sender)}>
              <CalendarIcon width={16} height={16} /> Add to calendar
            </button>
          </div>
        )}

        {needsReceived && (
          <div className="received">
            <label htmlFor={`${uid}-received`}>A deadline counts from the day you got this letter. When was that?</label>
            <input
              id={`${uid}-received`}
              ref={receivedRef}
              type="date"
              value={receivedDate}
              onChange={(e) => onReceivedDate(e.target.value)}
            />
          </div>
        )}

        <div className="answer-actions">
          {save && (
            <button className="secondary small-btn" onClick={save.onSave} disabled={save.saved}>
              {save.saved ? <><CheckIcon width={16} height={16} /> In My papers</> : <><LockIcon width={16} height={16} /> Keep in My papers</>}
            </button>
          )}
          {canSpeak() && (
            <button className="secondary small-btn" onClick={listen} aria-pressed={speaking}>
              <SpeakerIcon width={16} height={16} /> {speaking ? 'Stop' : 'Listen'}
            </button>
          )}
          {letter.source === 'in_cloud' && (
            <span className="badge badge-in_cloud"><CloudIcon width={14} height={14} /> Explained in the cloud</span>
          )}
          {letter.source === 'on_device' && (
            <span className="badge badge-on_device"><DeviceIcon width={14} height={14} /> Explained on your device</span>
          )}
        </div>
        {save?.saved && <p className="small muted">Kept only on this device, never your hidden details.</p>}
        {save?.error && <p className="small warning-text" role="alert">{save.error}</p>}
        {voiceMissing && (
          <p className="small muted">Your device has no offline voice for {letter.language}.</p>
        )}
      </section>

      <div className="tabs" role="tablist" aria-label="This letter" ref={tabsRef} onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`${uid}-tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`${uid}-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'steps' && todo.length > 0 && <span className="tab-count">{todo.length - doneCount}</span>}
          </button>
        ))}
      </div>

      <div id={`${uid}-panel-steps`} role="tabpanel" aria-labelledby={`${uid}-tab-steps`} hidden={tab !== 'steps'} className="tab-panel">
        {todo.length > 0 && (
          <div className="progress-line">
            <div className="progress-track"><span style={{ width: `${(doneCount / todo.length) * 100}%` }} /></div>
            <span className="small muted">{doneCount} of {todo.length} done</span>
          </div>
        )}
        {todo.length === 0 && <p className="muted">There is nothing you need to do for this letter.</p>}
        {GROUPS.map((group) => {
          const items = todo.filter((a) => a.group === group.kind)
          if (items.length === 0) return null
          return (
            <section key={group.kind} className={`step-group group-${group.kind}`}>
              <h2 className="step-group-title">{group.title}</h2>
              <ul className="step-list">
                {items.map((action) => (
                  <StepRow
                    key={action.index}
                    action={action}
                    sender={letter.sender}
                    langProps={langProps}
                    open={openStep === action.index}
                    onOpen={() => setOpenStep(openStep === action.index ? null : action.index)}
                    onToggleDone={onToggleDone}
                    onShowInLetter={showInLetter}
                    onReply={() => reply()}
                    onAskDate={() => receivedRef.current?.focus()}
                  />
                ))}
              </ul>
            </section>
          )
        })}

        {toCheck.length > 0 && (
          <details className="check-group">
            <summary>
              {toCheck.length} more {toCheck.length === 1 ? 'point needs' : 'points need'} checking
            </summary>
            <p className="small muted">
              Kamarat could not find the sentence in your letter that these are based on. Read your letter before
              acting on them.
            </p>
            <ul>
              {toCheck.map((a) => (
                <li key={a.index} {...langProps}>{a.title}</li>
              ))}
            </ul>
          </details>
        )}

        {letter.pages.length > 0 && (
          <section className="read-more">
            <h2 className="step-group-title">Read more on official sites</h2>
            <div className="sources">
              {letter.pages.map(({ page, why }) => (
                <a key={page.id} className="source" href={page.url} target="_blank" rel="noopener noreferrer">
                  <span className="source-icon" aria-hidden="true"><LandmarkIcon /></span>
                  <span className="source-body">
                    <span className="eyebrow">{page.agency}</span>
                    <strong>{page.title}</strong>
                    {why && <span className="small" {...langProps}>{why}</span>}
                    <span className="small source-url">{new URL(page.url).hostname}</span>
                  </span>
                  <ArrowIcon className="source-arrow" />
                </a>
              ))}
            </div>
          </section>
        )}
      </div>

      <div id={`${uid}-panel-ask`} role="tabpanel" aria-labelledby={`${uid}-tab-ask`} hidden={tab !== 'ask'} className="tab-panel">
        <AskKamarat
          shared={letter.shared}
          labelMap={labelMap}
          details={details}
          language={letter.language}
          onAskSender={(text) => reply({ intent: 'question', note: text })}
        />
      </div>

      <div id={`${uid}-panel-reply`} role="tabpanel" aria-labelledby={`${uid}-tab-reply`} hidden={tab !== 'reply'} className="tab-panel">
        <DraftReply
          shared={letter.shared}
          labelMap={labelMap}
          details={details}
          language={letter.language}
          prefill={replyPrefill}
        />
      </div>

      <div id={`${uid}-panel-letter`} role="tabpanel" aria-labelledby={`${uid}-tab-letter`} hidden={tab !== 'letter'} className="tab-panel">
        <LetterText shared={letter.shared} language={letter.language} highlight={highlight} />
      </div>
    </article>
  )
}
