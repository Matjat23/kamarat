// Kamarat: understand an official letter without giving away who you are.
//
// Screens (the address bar shows where you are, so the back button works):
//   #/            Home
//   #/new         New letter, step 1: add your letter
//   #/check       New letter, step 2: check what is private
//   #/letter      New letter, step 3: the explained letter
//   #/papers      My papers
//   #/papers/<id> A kept letter
//
// The letter text and the hidden details live only in this page's memory.
// After a reload they are gone on purpose, and the screen says so.
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
import { readFile } from './scan'
import { readClipboard } from './device'
import { stopSpeaking } from './speak'
import Home from './components/Home'
import AddLetter from './components/AddLetter'
import CheckLetter from './components/CheckLetter'
import ExplainStep from './components/ExplainStep'
import MyPapers, { SavedLetter } from './components/MyPapers'
import EvalPage from './components/EvalPage'
import { listPapers, PAPERS_CHANGED } from './papers'
import { Logo, FolderIcon, HomeIcon, PlusIcon } from './components/Icons'
import './App.css'
import './layout.css'

const METHOD_TEXT = {
  pdf: 'Text taken from your PDF on this device.',
  nano: 'Gemini Nano read your photo on this device. The photo was not uploaded.',
  tesseract: 'Your photo was read on this device. The photo was not uploaded.',
}

function readRoute() {
  const [view = '', id] = window.location.hash.replace(/^#\/?/, '').split('/')
  return { view: view || 'home', id }
}

// How many screens back inside Kamarat the browser can go.
const historyIndex = () => window.history.state?.kamarat ?? 0

function Expired({ onAdd, onHome }) {
  return (
    <section className="card">
      <h1 className="flow-title" tabIndex={-1} data-step-heading>Your letter is not here any more</h1>
      <p>
        For your privacy, Kamarat does not keep the text of your letter or your hidden details when the page is
        reloaded or closed. Letters you kept are still in My papers.
      </p>
      <div className="buttons">
        <button className="primary" onClick={onAdd}>Add a letter</button>
        <button className="secondary" onClick={onHome}>Home</button>
      </div>
    </section>
  )
}

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const [text, setText] = useState('')
  const [language, setLanguage] = useState('English')
  const [nanoStatus, setNanoStatus] = useState('checking')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [reading, setReading] = useState('')
  const [message, setMessage] = useState(null)
  const [focusText, setFocusText] = useState(0)
  const [details, setDetails] = useState([])
  const [detection, setDetection] = useState({ mode: 'ai', ignored: 0, lost: [] })
  // The text the current list of details belongs to. If the text changes, the
  // details are looked for again.
  const [checkedText, setCheckedText] = useState(null)
  const [shared, setShared] = useState('')
  // Label -> real detail. Kept in this page's memory only, never sent anywhere.
  const [labelMap, setLabelMap] = useState({})
  // Changes each time the person sends, so the explanation starts fresh.
  const [sendId, setSendId] = useState(0)
  // The id in My papers of the open letter, if it was kept.
  const [liveSavedId, setLiveSavedId] = useState(null)
  const [papers, setPapers] = useState(listPapers)
  const detectRun = useRef(0)

  function go(path = '', { replace = false } = {}) {
    const url = `#/${path}`
    if (replace) window.history.replaceState({ kamarat: historyIndex() }, '', url)
    else window.history.pushState({ kamarat: historyIndex() + 1 }, '', url)
    setRoute(readRoute())
  }

  // Like the browser's back button when there is a Kamarat screen to go back
  // to; otherwise it goes to the given screen.
  function goBack(fallback) {
    if (historyIndex() > 0) window.history.back()
    else go(fallback, { replace: true })
  }

  useEffect(() => {
    if (window.history.state?.kamarat === undefined) {
      window.history.replaceState({ kamarat: 0 }, '', window.location.href)
    }
    const onNavigate = () => setRoute(readRoute())
    const onPapers = () => setPapers(listPapers())
    window.addEventListener('popstate', onNavigate)
    window.addEventListener('hashchange', onNavigate)
    window.addEventListener(PAPERS_CHANGED, onPapers)
    checkOnDeviceModel().then(setNanoStatus)
    return () => {
      window.removeEventListener('popstate', onNavigate)
      window.removeEventListener('hashchange', onNavigate)
      window.removeEventListener(PAPERS_CHANGED, onPapers)
    }
  }, [])

  // On every new screen: stop reading aloud, scroll up, and move focus to the
  // screen's heading for keyboard and screen reader users.
  const routeKey = `${route.view}/${route.id ?? ''}`
  useEffect(() => {
    stopSpeaking()
    window.scrollTo({ top: 0 })
    requestAnimationFrame(() => {
      const heading = [...document.querySelectorAll('[data-step-heading]')].find((el) => el.offsetParent)
      heading?.focus({ preventScroll: true })
    })
  }, [routeKey])

  // Starting a new letter closes the open one. If it was not kept, ask first.
  function beginNewLetter() {
    if (shared && !liveSavedId) {
      const ok = window.confirm(
        'Start a new letter? The letter you have open is not kept in My papers, so its explanation will close.',
      )
      if (!ok) return false
    }
    detectRun.current += 1
    setShared('')
    setLabelMap({})
    setLiveSavedId(null)
    setText('')
    setDetails([])
    setCheckedText(null)
    setDetection({ mode: 'ai', ignored: 0, lost: [] })
    setMessage(null)
    setBusy(false)
    setProgress('')
    return true
  }

  async function readLetterFile(file, { fresh = false } = {}) {
    if (fresh && !beginNewLetter()) return
    go('new')
    setMessage(null)
    setReading('Opening the file on your device...')
    try {
      const { text: found, method, note } = await readFile(file, setReading)
      setText(found)
      setMessage({
        kind: note.includes('were not read') ? 'warn' : 'check',
        text: `${METHOD_TEXT[method] ?? METHOD_TEXT.pdf} ${note} Check that the text matches your letter, especially numbers and dates.`.replace(/\s+/g, ' '),
      })
    } catch (err) {
      setMessage({ kind: 'warn', text: err.message })
    } finally {
      setReading('')
    }
  }

  async function pasteFromClipboard() {
    setMessage(null)
    try {
      const copied = await readClipboard()
      if (copied.trim()) setText(copied)
      else setMessage({ kind: 'warn', text: 'The clipboard is empty. Copy the text of your letter first.' })
    } catch (err) {
      setMessage({ kind: 'warn', text: err.message })
    }
  }

  function startPaste() {
    if (!beginNewLetter()) return
    setFocusText((n) => n + 1)
    go('new')
  }

  function pickExample(example, { fresh = false } = {}) {
    if (fresh && !beginNewLetter()) return
    setText(example.text)
    setMessage(null)
    go('new')
  }

  function newLetter() {
    if (beginNewLetter()) go('new')
  }

  async function findDetails() {
    // Same text as last time: keep the list, including what you hid yourself.
    if (checkedText !== null && checkedText === text) {
      go('check')
      return
    }
    const run = ++detectRun.current
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
    // A new letter was started while this was running: drop the result.
    if (run !== detectRun.current) return

    const { details: found, ignored } = mergeDetails(text, aiItems, patternItems)
    // Keep what you hid yourself the last time. If it is no longer in the
    // text (for example after a correction), say so instead of dropping it quietly.
    const yours = details.filter((d) => d.foundBy.includes('you'))
    const kept = yours.filter((d) => occurrences(text, d.text).length > 0)
    const lost = yours.filter((d) => occurrences(text, d.text).length === 0).map((d) => d.text)
    const known = new Set(found.map((d) => d.text.toLowerCase()))
    setDetails([...found, ...kept.filter((d) => !known.has(d.text.toLowerCase()))])
    setDetection({ mode, ignored, lost })
    setCheckedText(text)
    setBusy(false)
    setProgress('')
    if (readRoute().view === 'new') go('check')
    checkOnDeviceModel().then(setNanoStatus)
  }

  function toggleDetail(id) {
    setDetails((list) => list.map((d) => (d.id === id ? { ...d, hidden: !d.hidden } : d)))
  }

  // Hides a piece of text the person typed or selected. Returns how many places
  // it was found, so the screen never claims "hidden" for text that is not there.
  function hideText(value) {
    const places = occurrences(text, value).length
    if (places === 0) return 0
    setDetails((list) => {
      const exists = list.find((d) => d.text.toLowerCase() === value.toLowerCase())
      if (exists) return list.map((d) => (d.id === exists.id ? { ...d, hidden: true } : d))
      return [...list, makeUserDetail(value)]
    })
    return places
  }

  // One decision: the reviewed text is sent and explained straight away.
  function sendReviewed(sharedText, map) {
    setShared(sharedText)
    setLabelMap(map)
    setLiveSavedId(null)
    setSendId((n) => n + 1)
    go('letter')
  }

  const { view } = route
  const checkReady = checkedText !== null && checkedText === text
  const expired = (view === 'check' && !checkReady) || (view === 'letter' && !shared)
  const inFlow = view === 'new' || view === 'check'

  const navItems = [
    { id: 'home', label: 'Home', icon: HomeIcon, onClick: () => go('') },
    { id: 'new', label: 'New letter', icon: PlusIcon, onClick: newLetter },
    { id: 'papers', label: 'My papers', icon: FolderIcon, onClick: () => go('papers'), count: papers.length },
  ]
  const activeNav = inFlow || view === 'letter' ? 'new' : view

  return (
    <div className={`app ${inFlow ? 'in-flow' : ''}`}>
      <header className="top">
        <button className="brand" onClick={() => go('')} aria-label="Kamarat home">
          <Logo size={38} />
          <span className="wordmark">Kamarat</span>
        </button>

        <nav className="nav" aria-label="Main">
          {navItems.map(({ id, label, icon: Icon, onClick, count }) => (
            <button
              key={id}
              className={`nav-item ${activeNav === id ? 'active' : ''}`}
              aria-current={activeNav === id ? 'page' : undefined}
              onClick={onClick}
            >
              <Icon width={20} height={20} />
              <span>{label}</span>
              {count > 0 && <span className="papers-count">{count}</span>}
            </button>
          ))}
        </nav>

        <label className="language-pick">
          <span className="language-label">Answers in</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.name} value={l.name}>
                {l.native}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="main">
        {new URLSearchParams(window.location.search).has('eval') && <EvalPage />}

        {expired && <Expired onAdd={newLetter} onHome={() => go('')} />}

        {view === 'home' && (
          <Home
            papers={papers}
            onResume={shared ? () => go('letter') : null}
            onFile={(file) => readLetterFile(file, { fresh: true })}
            onPaste={startPaste}
            onExample={(example) => pickExample(example, { fresh: true })}
            onOpenPaper={(id) => go(`papers/${id}`)}
            onOpenPapers={() => go('papers')}
          />
        )}

        {view === 'new' && (
          <AddLetter
            text={text}
            setText={setText}
            nanoStatus={nanoStatus}
            reading={reading}
            message={message}
            onFile={readLetterFile}
            onPaste={pasteFromClipboard}
            onExample={pickExample}
            busy={busy}
            progress={progress}
            onFind={findDetails}
            onBack={() => goBack('')}
            focusText={focusText}
          />
        )}

        {view === 'check' && checkReady && (
          <CheckLetter
            text={text}
            details={details}
            detection={detection}
            language={language}
            setLanguage={setLanguage}
            onToggle={toggleDetail}
            onHideText={hideText}
            onBack={() => goBack('new')}
            onSend={sendReviewed}
          />
        )}

        {view === 'papers' && !route.id && <MyPapers onOpen={(id) => go(`papers/${id}`)} onNew={newLetter} />}
        {view === 'papers' && route.id && (
          <SavedLetter key={route.id} id={route.id} language={language} onBack={() => go('papers')} />
        )}

        {/* The explained letter stays mounted while you look elsewhere, so going
            back to it does not ask Gemini again. */}
        {shared && (
          <div hidden={view !== 'letter'}>
            <ExplainStep
              key={sendId}
              shared={shared}
              labelMap={labelMap}
              details={details}
              language={language}
              onSavedChange={setLiveSavedId}
              onBack={() => go('check')}
              onHome={() => go('')}
            />
          </div>
        )}
      </main>

      <footer className="footer">
        Kamarat explains letters. It is not legal advice. Built with Gemini Nano on your device and Gemini in the
        cloud, through Firebase AI Logic.
      </footer>
    </div>
  )
}
