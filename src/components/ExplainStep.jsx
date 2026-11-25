// Step 3: the reviewed text is explained as soon as this screen opens (the
// person already chose to send it). While waiting, Katty shows what it is
// doing. Then the letter screen takes over.
import { useEffect, useRef, useState } from 'react'
import { explainNotice } from '../explain'
import { savePaper, updatePaper, listPapers, PAPERS_CHANGED } from '../papers'
import { stopSpeaking } from '../speak'
import LetterView from './LetterView'
import { t, msg } from '../i18n'
import { CheckIcon, Dots } from './Icons'

const STAGES = [
  msg('Reading your letter'),
  msg('Finding what you need to do'),
  msg('Checking every answer against your letter'),
  msg('Working out your dates'),
]

function Progress({ stage, status }) {
  return (
    <section className="card reading-card">
      <span className="eyebrow">{t('Step {step} of 3', { step: 3 })}</span>
      <h1 className="flow-title" tabIndex={-1} data-step-heading>{t("Okay, let's see what this is about")}</h1>
      <ol className="stages">
        {STAGES.map((label, i) => (
          <li key={label} className={i < stage ? 'is-done' : i === stage ? 'is-now' : ''}>
            <span className="stage-dot" aria-hidden="true">
              {i < stage ? <CheckIcon width={14} height={14} /> : i === stage ? <Dots /> : null}
            </span>
            {t(label)}
          </li>
        ))}
      </ol>
      {status && <p className="small muted" role="status">{status}</p>}
    </section>
  )
}

export default function ExplainStep({ shared, labelMap, details, language, country, onSavedChange, onBack, onHome }) {
  const [state, setState] = useState({ phase: 'loading', status: '' })
  const [stage, setStage] = useState(0)
  const [receivedDate, setReceivedDate] = useState('')
  const [done, setDone] = useState([])
  const [savedId, setSavedId] = useState(null)
  const [saveError, setSaveError] = useState('')
  const started = useRef(false)
  const rootRef = useRef(null)

  async function send() {
    // A new explanation can have different steps, so old ticks are cleared.
    // If the letter was kept, it is saved again once the new one arrives.
    stopSpeaking()
    setDone([])
    setStage(0)
    setState({ phase: 'loading', status: '' })
    const timer = setTimeout(() => setStage(1), 2500)
    try {
      const result = await explainNotice(shared, language, (status) => setState({ phase: 'loading', status }), country)
      clearTimeout(timer)
      // The note says when the device had to answer in English instead.
      const shownIn = result.note?.includes('this is in English') ? 'English' : language
      setState({ phase: 'done', result: { ...result, language: shownIn, country } })
    } catch (err) {
      clearTimeout(timer)
      setState({ phase: 'error', message: err.message })
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    send()
  }, [])

  useEffect(() => () => stopSpeaking(), [])

  // Moves focus to the answer when it arrives, but only if this screen is the
  // one being looked at.
  useEffect(() => {
    if (state.phase !== 'done') return
    requestAnimationFrame(() => {
      if (rootRef.current?.offsetParent) {
        rootRef.current.querySelector('.answer-title')?.focus({ preventScroll: true })
      }
    })
  }, [state.phase])

  useEffect(() => {
    onSavedChange?.(savedId)
  }, [savedId])

  // Once kept, My papers holds the one true copy. If it is changed or deleted
  // there, this screen follows instead of saving an old version over it.
  useEffect(() => {
    if (!savedId) return
    function sync() {
      const paper = listPapers().find((p) => p.id === savedId)
      if (!paper) {
        setSavedId(null)
        return
      }
      setDone(paper.done)
      setReceivedDate(paper.receivedDate)
    }
    window.addEventListener(PAPERS_CHANGED, sync)
    return () => window.removeEventListener(PAPERS_CHANGED, sync)
  }, [savedId])

  function save(id = savedId ?? crypto.randomUUID()) {
    const { result } = state
    const ok = savePaper({
      id,
      savedAt: new Date().toISOString(),
      sender: result.sender,
      summary: result.summary,
      worry: result.worry,
      language: result.language,
      noticeDate: result.noticeDate,
      country: result.country,
      receivedDate,
      shared,
      done,
      actions: result.actions.map((a) => ({
        title: a.title,
        explanation: a.explanation,
        kind: a.kind,
        quote: a.quote,
        quoteFound: a.quoteFound,
        deadline: a.deadline,
      })),
      pages: result.pages.map(({ page }) => page.id),
      sites: result.sites,
    })
    if (ok) {
      setSavedId(id)
      setSaveError('')
    } else {
      setSaveError(t('Katty could not save on this device. The browser may be in private mode or out of space.'))
    }
  }

  // Keeps a kept letter up to date when the received date is added, or when
  // the letter is explained again.
  useEffect(() => {
    if (savedId && state.phase === 'done') save(savedId)
  }, [receivedDate, state.result])

  function toggleDone(index) {
    const next = done.includes(index) ? done.filter((i) => i !== index) : [...done, index]
    setDone(next)
    if (savedId && !updatePaper(savedId, { done: next })) {
      setSaveError(t('Katty could not update My papers on this device.'))
    }
  }

  if (state.phase === 'loading') return <div ref={rootRef}><Progress stage={stage} status={state.status} /></div>

  if (state.phase === 'error') {
    return (
      <section className="card" ref={rootRef}>
        <h1 className="flow-title" tabIndex={-1} data-step-heading>{t("That didn't work this time")}</h1>
        <p className="notice notice-warn" role="alert">{state.message}.</p>
        <div className="buttons">
          <button className="secondary" onClick={onBack}>{t('Back')}</button>
          <button className="primary" onClick={send}>{t('Try again')}</button>
        </div>
      </section>
    )
  }

  return (
    <div ref={rootRef}>
    <LetterView
      letter={{ ...state.result, shared }}
      currentLanguage={language}
      onExplainAgain={send}
      receivedDate={receivedDate}
      onReceivedDate={setReceivedDate}
      done={done}
      onToggleDone={toggleDone}
      labelMap={labelMap}
      details={details}
      save={{ saved: !!savedId, onSave: () => save(), error: saveError }}
      onBack={onHome}
      backLabel={t('Home')}
      menu={[
        { label: t('Explain it again in {language}', { language }), onClick: send },
        { label: t('Change what was hidden'), onClick: onBack },
      ]}
    />
    </div>
  )
}
