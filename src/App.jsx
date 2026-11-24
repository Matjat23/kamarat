// Kamarat: understand an official notice without giving away who you are.
// Flow: paste -> find personal details on this device -> review and approve.
import { useEffect, useState } from 'react'
import { detectorModel, checkOnDeviceModel } from './firebase'
import {
  detectWithAI,
  detectWithPatterns,
  mergeDetails,
  makeUserDetail,
} from './privacy'
import PasteStep from './components/PasteStep'
import ReviewStep from './components/ReviewStep'
import ExplainStep from './components/ExplainStep'
import { Logo, CheckIcon } from './components/Icons'
import './App.css'

const STEPS = [
  { id: 'paste', label: 'Paste' },
  { id: 'review', label: 'Check' },
  { id: 'explain', label: 'Understand' },
]

export default function App() {
  const [step, setStep] = useState('paste')
  const [text, setText] = useState('')
  const [nanoStatus, setNanoStatus] = useState('checking')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [details, setDetails] = useState([])
  const [detection, setDetection] = useState({ mode: 'ai', ignored: 0 })
  const [shared, setShared] = useState('')
  // Label -> real detail. Kept in this page's memory only, never sent anywhere.
  const [labelMap, setLabelMap] = useState({})

  useEffect(() => {
    checkOnDeviceModel().then(setNanoStatus)
  }, [])

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

  function hideText(value) {
    setDetails((list) => {
      const exists = list.find((d) => d.text.toLowerCase() === value.toLowerCase())
      if (exists) {
        return list.map((d) => (d.id === exists.id ? { ...d, hidden: true } : d))
      }
      return [...list, makeUserDetail(value)]
    })
  }

  function approve(sharedText, map) {
    setShared(sharedText)
    setLabelMap(map)
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
          onToggle={toggleDetail}
          onHideText={hideText}
          onBack={() => setStep('paste')}
          onApprove={approve}
        />
      )}

      {step === 'explain' && (
        <ExplainStep
          shared={shared}
          labelMap={labelMap}
          details={details}
          onBack={() => setStep('review')}
          onRestart={restart}
        />
      )}

      <footer className="footer">
        <span>Kamarat explains notices. It is not legal advice, and it does not make you anonymous.</span>
        <span>
          Built with Gemini Nano on your device and Gemini in the cloud, through Firebase AI Logic.
        </span>
      </footer>
    </div>
  )
}
