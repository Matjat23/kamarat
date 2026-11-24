// Step 3: the reviewed text is explained as soon as this screen opens (the
// person already chose to send it). While waiting, Kamarat shows what it is
// doing. Then the letter screen takes over.
import { useEffect, useRef, useState } from 'react'
import { explainNotice } from '../explain'
import { savePaper, updatePaper } from '../papers'
import { stopSpeaking } from '../speak'
import LetterView from './LetterView'
import { CheckIcon, Dots } from './Icons'

const STAGES = [
  'Reading your letter',
  'Finding what you need to do',
  'Checking every answer against your letter',
  'Working out your dates',
]

function Progress({ stage, status }) {
  return (
    <section className="card reading-card">
      <span className="eyebrow">Step 3 of 3</span>
      <h1 className="flow-title" tabIndex={-1} data-step-heading>Okay, let's see what this is about</h1>
      <ol className="stages">
        {STAGES.map((label, i) => (
          <li key={label} className={i < stage ? 'is-done' : i === stage ? 'is-now' : ''}>
            <span className="stage-dot" aria-hidden="true">
              {i < stage ? <CheckIcon width={14} height={14} /> : i === stage ? <Dots /> : null}
            </span>
            {label}
          </li>
        ))}
      </ol>
      {status && <p className="small muted" role="status">{status}</p>}
    </section>
  )
}

export default function ExplainStep({ shared, labelMap, details, language, onBack, onHome }) {
  const [state, setState] = useState({ phase: 'loading', status: '' })
  const [stage, setStage] = useState(0)
  const [receivedDate, setReceivedDate] = useState('')
  const [done, setDone] = useState([])
  const [savedId, setSavedId] = useState(null)
  const [saveError, setSaveError] = useState('')
  const started = useRef(false)

  async function send() {
    // A new explanation can have different steps, so old ticks are cleared.
    // If the letter was kept, it is saved again once the new one arrives.
    stopSpeaking()
    setDone([])
    setStage(0)
    setState({ phase: 'loading', status: '' })
    const timer = setTimeout(() => setStage(1), 2500)
    try {
      const result = await explainNotice(shared, language, (status) => setState({ phase: 'loading', status }))
      clearTimeout(timer)
      // The note says when the device had to answer in English instead.
      const shownIn = result.note?.includes('this is in English') ? 'English' : language
      setState({ phase: 'done', result: { ...result, language: shownIn } })
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

  // Moves focus to the answer when it arrives.
  useEffect(() => {
    if (state.phase === 'done') {
      requestAnimationFrame(() => document.querySelector('.answer-title')?.focus({ preventScroll: true }))
    }
  }, [state.phase])

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
    })
    if (ok) {
      setSavedId(id)
      setSaveError('')
    } else {
      setSaveError('Kamarat could not save on this device. The browser may be in private mode or out of space.')
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
      setSaveError('Kamarat could not update My papers on this device.')
    }
  }

  if (state.phase === 'loading') return <Progress stage={stage} status={state.status} />

  if (state.phase === 'error') {
    return (
      <section className="card">
        <h1 className="flow-title" tabIndex={-1} data-step-heading>That didn't work this time</h1>
        <p className="notice notice-warn" role="alert">{state.message}.</p>
        <div className="buttons">
          <button className="secondary" onClick={onBack}>Back</button>
          <button className="primary" onClick={send}>Try again</button>
        </div>
      </section>
    )
  }

  return (
    <LetterView
      letter={{ ...state.result, shared }}
      receivedDate={receivedDate}
      onReceivedDate={setReceivedDate}
      done={done}
      onToggleDone={toggleDone}
      labelMap={labelMap}
      details={details}
      save={{ saved: !!savedId, onSave: () => save(), error: saveError }}
      onBack={onHome}
      backLabel="Home"
      menu={[
        { label: `Explain again in ${language}`, onClick: send },
        { label: 'Change what was hidden', onClick: onBack },
      ]}
    />
  )
}
