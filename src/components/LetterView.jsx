// The letter screen: one answer card on top, then four tabs.
//   Steps  - what to do, as a checklist. Tap a step for the details.
//   Ask    - follow-up questions about this letter.
//   Reply  - draft a reply to the sender.
//   Letter - the text that was sent, with word help.
// Used for a letter that was just explained and for a letter from My papers.
import { useId, useMemo, useRef, useState } from 'react'
import { languageProps, languageCode } from '../explain'
import { prepareActions } from '../papers'
import { WORRY, assessWorry, daysUntil, whenText } from '../worry'
import { t, msg, dateLocale, uiLanguageCode } from '../i18n'
import { downloadDeadline } from '../calendar'
import { speak, stopSpeaking, canSpeak, spokenPhrases, spokenDate } from '../speak'
import AskKamarat from './AskKamarat'
import DraftReply from './DraftReply'
import LetterText from './LetterText'
import OfficialSearch from './OfficialSearch'
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
  { id: 'steps', label: msg('Steps') },
  { id: 'ask', label: msg('Ask') },
  { id: 'reply', label: msg('Reply') },
  { id: 'letter', label: msg('Letter') },
]

const GROUPS = [
  { kind: 'MUST', title: msg('You must') },
  { kind: 'CAN', title: msg('You can') },
  { kind: 'UNCLEAR', title: msg('Not clear yet') },
]

function shortDate(date) {
  return date.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
}

function longDate(date) {
  return date.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
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
    details: `${action.explanation}\n\n${t('From {sender}', { sender })}: "${action.quote}"\n\n${action.info.basis}\n${t('Made with Kamarat. Always check the original letter.')}`,
  })
}

function DateTile({ date }) {
  return (
    <div className="date-tile" aria-hidden="true">
      <span className="date-month">{date.toLocaleDateString(dateLocale(), { month: 'short' })}</span>
      <span className="date-day">{date.getDate()}</span>
      <span className="date-weekday">{date.toLocaleDateString(dateLocale(), { weekday: 'short' })}</span>
    </div>
  )
}

function DateChip({ info, done }) {
  if (!info) return null
  if (!info.date) return <span className="date-chip chip-unknown">{t('Date not known')}</span>
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
          aria-label={action.done ? t('Mark "{title}" as not done', { title: action.title }) : t('Mark "{title}" as done', { title: action.title })}
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
              <strong>{t('By {date}', { date: longDate(info.date) })}</strong> ({whenText(info.date)}). <span className="muted">{info.basis}</span>
              {info.businessNote && (
                <span className="muted">
                  {' '}{t('Weekends ({days}) are skipped. Public holidays are not, so check if one falls in between.', { days: info.businessNote })}
                </span>
              )}
            </p>
          )}
          {info?.unchecked && (
            <p className="small warning-text">{t('Kamarat could not match this date to your letter. Check it before you rely on it.')}</p>
          )}
          {info && !info.date && <p className="small muted">{info.text}</p>}
          <div className="step-links">
            <button className="link-button" onClick={() => onShowInLetter(action.quote)}>{t('From your letter')}</button>
            {info?.needs === 'received' && (
              <button className="link-button" onClick={onAskDate}>{t('Add the day you got it')}</button>
            )}
            {info?.date && (
              <button className="link-button" onClick={() => addToCalendar(action, sender)}>
                <CalendarIcon width={14} height={14} /> {t('Add to calendar')}
              </button>
            )}
            {action.group === 'MUST' && (
              <button className="link-button" onClick={onReply}>
                <PenIcon width={14} height={14} /> {t('Draft a reply')}
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
  currentLanguage,
  country = '',
  onExplainAgain,
  explaining = false,
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
    () => prepareActions(letter.actions, { noticeDate: letter.noticeDate, receivedDate, done, country: letter.country }),
    // The language on screen is a dependency too: the deadline sentences are translated.
    [letter, receivedDate, done, uiLanguageCode()],
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
    const index = TABS.findIndex((item) => item.id === tab)
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
    const code = languageCode(letter.language)
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
            <span className="small muted">{t('From')}</span> <strong>{letter.sender}</strong>
          </span>
        </span>
        {menu.length > 0 && (
          <details className="more-menu">
            <summary aria-label={t('More options')}>{t('More')}</summary>
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

        {currentLanguage && currentLanguage !== letter.language && onExplainAgain && (
          <div className="language-change" role="status">
            <span className="small">
              {t('This explanation is in {from}. Your language is now {to}.', { from: letter.language, to: currentLanguage })}
            </span>
            <button className="secondary small-btn" onClick={onExplainAgain} disabled={explaining}>
              {explaining ? t('Explaining...') : t('Explain it again in {language}', { language: currentLanguage })}
            </button>
          </div>
        )}

        {/* A deadline that counts from the day you got the letter may come
            first, so that question comes before the next known date. */}
        {needsReceived && (
          <div className="received received-first">
            <label htmlFor={`${uid}-received`}>
              {t('First, when did you get this letter? A deadline counts from that day, and it could be the first one.')}
            </label>
            <input
              id={`${uid}-received`}
              ref={receivedRef}
              type="date"
              value={receivedDate}
              onChange={(e) => onReceivedDate(e.target.value)}
            />
          </div>
        )}

        {next && (
          <div className="answer-next">
            <DateTile date={next.info.date} />
            <div className="answer-next-body">
              <span className="eyebrow">
                {unknownDates > 0 ? t('Earliest known date') : t('Next deadline')} · {whenText(next.info.date)}
              </span>
              <strong {...langProps}>{next.title}</strong>
              <span className="small muted">{t('By {date}', { date: longDate(next.info.date) })}</span>
              {next.info.unchecked && <span className="small warning-text">{t('Check this date in your letter.')}</span>}
              {unknownDates > 0 && (
                <span className="small warning-text">
                  {unknownDates === 1
                    ? t('One more deadline is not known yet and could come first.')
                    : t('{count} more deadlines are not known yet and could come first.', { count: unknownDates })}
                </span>
              )}
            </div>
            <button className="secondary small-btn" onClick={() => addToCalendar(next, letter.sender)}>
              <CalendarIcon width={16} height={16} /> {t('Add to calendar')}
            </button>
          </div>
        )}

        <div className="answer-actions">
          {save && (
            <button className="secondary small-btn" onClick={save.onSave} disabled={save.saved}>
              {save.saved ? <><CheckIcon width={16} height={16} /> {t('In My papers')}</> : <><LockIcon width={16} height={16} /> {t('Keep in My papers')}</>}
            </button>
          )}
          {canSpeak() && (
            <button className="secondary small-btn" onClick={listen} aria-pressed={speaking}>
              <SpeakerIcon width={16} height={16} /> {speaking ? t('Stop') : t('Listen')}
            </button>
          )}
          {letter.source === 'in_cloud' && (
            <span className="badge badge-in_cloud"><CloudIcon width={14} height={14} /> {t('Explained in the cloud')}</span>
          )}
          {letter.source === 'on_device' && (
            <span className="badge badge-on_device"><DeviceIcon width={14} height={14} /> {t('Explained on your device')}</span>
          )}
        </div>
        {save?.saved && <p className="small muted">{t('Kept only on this device, never your hidden details.')}</p>}
        {save?.error && <p className="small warning-text" role="alert">{save.error}</p>}
        {voiceMissing && (
          <p className="small muted">{t('Your device has no offline voice for {language}.', { language: letter.language })}</p>
        )}
      </section>

      <div className="tabs" role="tablist" aria-label={t('This letter')} ref={tabsRef} onKeyDown={onTabKey}>
        {TABS.map((item) => (
          <button
            key={item.id}
            id={`${uid}-tab-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`${uid}-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            <span className="tab-label">{t(item.label)}</span>
            {item.id === 'steps' && todo.length > 0 && <span className="tab-count">{todo.length - doneCount}</span>}
          </button>
        ))}
      </div>

      <div id={`${uid}-panel-steps`} role="tabpanel" aria-labelledby={`${uid}-tab-steps`} hidden={tab !== 'steps'} className="tab-panel">
        {todo.length > 0 && (
          <div className="progress-line">
            <div className="progress-track"><span style={{ width: `${(doneCount / todo.length) * 100}%` }} /></div>
            <span className="small muted">{t('{done} of {total} done', { done: doneCount, total: todo.length })}</span>
          </div>
        )}
        {todo.length === 0 && toCheck.length === 0 && (
          <p className="muted">{t('Kamarat found nothing you need to do for this letter.')}</p>
        )}
        {todo.length === 0 && toCheck.length > 0 && (
          <p className="notice notice-warn" role="status">
            {t('Kamarat could not check what this letter asks of you. The points below could not be matched to your letter, so read it before you act. The Letter tab shows the full text.')}
          </p>
        )}
        {GROUPS.map((group) => {
          const items = todo.filter((a) => a.group === group.kind)
          if (items.length === 0) return null
          return (
            <section key={group.kind} className={`step-group group-${group.kind}`}>
              <h2 className="step-group-title">{t(group.title)}</h2>
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
          <details className="check-group" open={todo.length === 0}>
            <summary>
              {t('Points to check: {count}', { count: toCheck.length })}
            </summary>
            <p className="small muted">
              {t('Kamarat could not find the sentence in your letter that these are based on. Read your letter before acting on them.')}
            </p>
            <ul>
              {toCheck.map((a) => (
                <li key={a.index} {...langProps}>{a.title}</li>
              ))}
            </ul>
          </details>
        )}

        <section className="read-more">
          <h2 className="step-group-title">{t('Read more on official sites')}</h2>
          {letter.pages.length > 0 && (
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
          )}
          {(letter.sites ?? []).length > 0 && (
            <div className="sources">
              {letter.sites.map((site) => (
                <a key={site.domain} className="source" href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer">
                  <span className="source-icon" aria-hidden="true"><LandmarkIcon /></span>
                  <span className="source-body">
                    <span className="eyebrow">{t('Official website')}</span>
                    <strong>{site.name || site.domain}</strong>
                    {site.why && <span className="small" {...langProps}>{site.why}</span>}
                    <span className="small source-url">{site.domain} · {t('government address checked')}</span>
                  </span>
                  <ArrowIcon className="source-arrow" />
                </a>
              ))}
            </div>
          )}
          {letter.pages.length === 0 && !(letter.sites ?? []).length && (
            <p className="small muted">{t('Kamarat found no official pages it could check for this letter.')}</p>
          )}
          {/* Searching the web needs the paid Gemini plan, so it is switched on
              with VITE_WEB_SEARCH=on once that plan is in place. */}
          {import.meta.env.VITE_WEB_SEARCH === 'on' && (
            <OfficialSearch letter={letter} steps={todo.map((a) => a.title)} country={letter.country || country} />
          )}
        </section>
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
