// Kamarat: understand an official notice without giving away who you are.
// Flow: get the notice in -> find personal details on this device ->
// check and send -> your next steps.
import { useEffect, useRef, useState } from 'react'
import { detectorModel, checkOnDeviceModel } from './firebase'
import {
  detectWithAI,
  detectWithPatterns,
  mergeDetails,
  makeUserDetail,
  occurrences,
} from './privacy'
import { LANGUAGES } from './explain'
import PasteStep from './components/PasteStep'
import ReviewStep from './components/ReviewStep'
import ExplainStep from './components/ExplainStep'
import { Logo, CheckIcon } from './components/Icons'
import './App.css'

const STEPS = [
  { id: 'paste', label: 'Your notice' },
  { id: 'review', label: 'Check & send' },
  { id: 'explain', label: 'Next steps' },
]

export default function App() {
  const [step, setStep] = useState('paste')
  const [text, setText] = useState('')
  const [language, setLanguage] = useState('English')
  const [nanoStatus, setNanoStatus] = useState('checking')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [details, setDetails] = useState([])
  const [detection, setDetection] = useState({ mode: 'ai', ignored: 0 })
  const [shared, setShared] = useState('')
  // Label -> real detail. Kept in this page's memory only, never sent anywhere.
  const [labelMap, setLabelMap] = useState({})
  // Changes each time the person sends, so the explanation starts fresh.
  const [sendId, setSendId] = useState(0)

  useEffect(() => {
    checkOnDeviceModel().then(setNanoStatus)
  }, [])

  // When the step changes, scroll up and move keyboard and screen reader focus
  // to the new step's heading (not on the very first load).
  const firstRender = useRef(true)
  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    requestAnimationFrame(() =>
      document.querySelector('[data-step-heading]')?.focus({ preventScroll: true }),
    )
  }, [step])

  async function findDetails() {
    setBusy(true)
    const patternItems = detectWithPatterns(text)
    let aiItems = []
    let mode = 'manual'

    // Only try the AI when Chrome says the on-device model can run.
    // ONLY_ON_DEVICE means a failure here can never turn into a cloud call.
    if (!['unsupported', 'unavailable'].includes(nanoStatus)) {
      try {
        setProgress('Starting private on-device AI...')
        await detectorModel.initializeDeviceModel((value) =>
          setProgress(`Downloading on-device AI: ${Math.round(value * 100)}%`),
        )
        setProgress('Looking for personal details on your device...')
        const result = await detectWithAI(detectorModel, text)
        aiItems = result.items
        mode = 'ai'
      } catch (err) {
        console.warn('On-device detection failed, using pattern check only.', err)
      }
    }

    const { details: found, ignored } = mergeDetails(text, aiItems, patternItems)
    setDetails(found)
    setDetection({ mode, ignored })
    setBusy(false)
    setProgress('')
    setStep('review')
    checkOnDeviceModel().then(setNanoStatus)
  }

  function toggleDetail(id) {
    setDetails((list) =>
      list.map((d) => (d.id === id ? { ...d, hidden: !d.hidden } : d)),
    )
  }

  // Hides a piece of text the person typed or selected. Returns how many places
  // it was found, so the screen never claims "hidden" for text that is not there.
  function hideText(value) {
    const places = occurrences(text, value).length
    if (places === 0) return 0
    setDetails((list) => {
      const exists = list.find((d) => d.text.toLowerCase() === value.toLowerCase())
      if (exists) {
        return list.map((d) => (d.id === exists.id ? { ...d, hidden: true } : d))
      }
      return [...list, makeUserDetail(value)]
    })
    return places
  }

  // One decision: the reviewed text is sent and explained straight away.
  function sendReviewed(sharedText, map) {
    setShared(sharedText)
    setLabelMap(map)
    setSendId((n) => n + 1)
    setStep('explain')
  }

  function restart() {
    setText('')
    setDetails([])
    setShared('')
    setLabelMap({})
    setStep('paste')
  }

  return (
    <div className="app">
      <header className="top">
        <button className="brand" onClick={restart} aria-label="Kamarat, start over">
          <Logo size={42} />
          <span className="brand-text">
            <span className="wordmark">Kamarat</span>
            <span className="tagline">A friend who knows the system</span>
          </span>
        </button>

        <label className="language-pick">
          <span className="small muted">Explanations in</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.name} value={l.name}>
                {l.native}
              </option>
            ))}
          </select>
        </label>

        <ol className="steps" aria-label="Progress">
          {STEPS.map((s, i) => {
            const current = STEPS.findIndex((x) => x.id === step)
            const state = i < current ? 'done' : i === current ? 'current' : ''
            return (
              <li key={s.id} className={state} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="step-dot">{state === 'done' ? <CheckIcon width={14} height={14} /> : i + 1}</span>
                <span className="step-label">{s.label}</span>
              </li>
            )
          })}
        </ol>
      </header>

      <main className="main">
        {step === 'paste' && (
          <PasteStep
            text={text}
            setText={setText}
            nanoStatus={nanoStatus}
            busy={busy}
            progress={progress}
            onFind={findDetails}
          />
        )}

        {step === 'review' && (
          <ReviewStep
            text={text}
            details={details}
            detection={detection}
            language={language}
            setLanguage={setLanguage}
            onToggle={toggleDetail}
            onHideText={hideText}
            onBack={() => setStep('paste')}
            onSend={sendReviewed}
          />
        )}

        {step === 'explain' && (
          <ExplainStep
            key={sendId}
            shared={shared}
            labelMap={labelMap}
            details={details}
            language={language}
            onBack={() => setStep('review')}
            onRestart={restart}
          />
        )}
      </main>

      <footer className="footer">
        <span>Kamarat explains notices. It is not legal advice, and it does not make you anonymous.</span>
        <span>
          Built with Gemini Nano on your device and Gemini in the cloud, through Firebase AI Logic.
        </span>
      </footer>
    </div>
  )
}
