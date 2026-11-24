// Kamarat: understand an official letter without giving away who you are.
//
// Screens (the address bar shows where you are, so the back button works):
//   #/            Home
//   #/new         New letter, step 1: add your letter
//   #/check       New letter, step 2: check what is private
//   #/letter      New letter, step 3: the explained letter
//   #/papers      My papers
//   #/papers/<id> A kept letter
import { useEffect, useState } from 'react'
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
import Home from './components/Home'
import AddLetter from './components/AddLetter'
import CheckLetter from './components/CheckLetter'
import ExplainStep from './components/ExplainStep'
import MyPapers, { SavedLetter } from './components/MyPapers'
import EvalPage from './components/EvalPage'
import { listPapers } from './papers'
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

function go(path = '') {
  window.location.hash = `/${path}`
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
  const [detection, setDetection] = useState({ mode: 'ai', ignored: 0 })
  const [checked, setChecked] = useState(false)
  const [shared, setShared] = useState('')
  // Label -> real detail. Kept in this page's memory only, never sent anywhere.
  const [labelMap, setLabelMap] = useState({})
  // Changes each time the person sends, so the explanation starts fresh.
  const [sendId, setSendId] = useState(0)
  const [papers, setPapers] = useState(listPapers)

  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    checkOnDeviceModel().then(setNanoStatus)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // On every new screen: refresh the kept letters, scroll up, and move focus
  // to the screen's heading for keyboard and screen reader users.
  const routeKey = `${route.view}/${route.id ?? ''}`
  useEffect(() => {
    setPapers(listPapers())
    window.scrollTo({ top: 0 })
    requestAnimationFrame(() => {
      const heading = [...document.querySelectorAll('[data-step-heading]')].find((el) => el.offsetParent)
      heading?.focus({ preventScroll: true })
    })
  }, [routeKey])

  async function readLetterFile(file) {
    go('new')
    setMessage(null)
    setReading('Opening the file on your device...')
    try {
      const { text: found, method, note } = await readFile(file, setReading)
      setText(found)
      setChecked(false)
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
      if (copied.trim()) {
        setText(copied)
        setChecked(false)
      } else {
        setMessage({ kind: 'warn', text: 'The clipboard is empty. Copy the text of your letter first.' })
      }
    } catch (err) {
      setMessage({ kind: 'warn', text: err.message })
    }
  }

  function startPaste() {
    setMessage(null)
    setFocusText((n) => n + 1)
    go('new')
  }

  function pickExample(example) {
    setText(example.text)
    setChecked(false)
    setMessage(null)
    go('new')
  }

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
    setChecked(true)
    setBusy(false)
    setProgress('')
    go('check')
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
    setSendId((n) => n + 1)
    go('letter')
  }

  function newLetter() {
    setText('')
    setDetails([])
    setChecked(false)
    setMessage(null)
    go('new')
  }

  let { view } = route
  if (view === 'check' && !checked) view = 'new'
  if (view === 'letter' && !shared) view = 'home'
  const inFlow = view === 'new' || view === 'check'

  const navItems = [
    { id: 'home', label: 'Home', icon: HomeIcon, onClick: () => go('') },
    { id: 'new', label: 'New letter', icon: PlusIcon, onClick: newLetter },
    { id: 'papers', label: 'My papers', icon: FolderIcon, onClick: () => go('papers'), count: papers.length },
  ]
  const activeNav = inFlow ? 'new' : view === 'letter' ? 'new' : view

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
          <span className="visually-hidden">Answers in</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language for answers">
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

        {view === 'home' && (
          <Home
              papers={papers}
              onResume={shared ? () => go('letter') : null}
              onFile={readLetterFile}
              onPaste={startPaste}
              onExample={pickExample}
              onOpenPaper={(id) => go(`papers/${id}`)}
              onOpenPapers={() => go('papers')}
            />
        )}

        {view === 'new' && (
          <AddLetter
            text={text}
            setText={(value) => {
              setText(value)
              setChecked(false)
            }}
            nanoStatus={nanoStatus}
            reading={reading}
            message={message}
            onFile={readLetterFile}
            onPaste={pasteFromClipboard}
            onExample={pickExample}
            busy={busy}
            progress={progress}
            onFind={findDetails}
            onBack={() => go('')}
            focusText={focusText}
          />
        )}

        {view === 'check' && (
          <CheckLetter
            text={text}
            details={details}
            detection={detection}
            language={language}
            setLanguage={setLanguage}
            onToggle={toggleDetail}
            onHideText={hideText}
            onBack={() => go('new')}
            onSend={sendReviewed}
          />
        )}

        {view === 'papers' && !route.id && <MyPapers onOpen={(id) => go(`papers/${id}`)} onNew={newLetter} />}
        {view === 'papers' && route.id && <SavedLetter key={route.id} id={route.id} onBack={() => go('papers')} />}

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
