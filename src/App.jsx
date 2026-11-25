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
import { readFile, readerLanguages } from './scan'
import { readClipboard } from './device'
import { stopSpeaking } from './speak'
import { guessCountry, savedCountry, saveCountry } from './countries'
import { t, msg, setUiTranslation, loadUiTranslation, primeUiTranslation } from './i18n'
import Home from './components/Home'
import AddLetter from './components/AddLetter'
import CheckLetter from './components/CheckLetter'
import ExplainStep from './components/ExplainStep'
import MyPapers, { SavedLetter } from './components/MyPapers'
import EvalPage from './components/EvalPage'
import TranslationsPage from './components/TranslationsPage'
import { listPapers, PAPERS_CHANGED } from './papers'
import { Logo, FolderIcon, HomeIcon, PlusIcon, CameraIcon, GlobeIcon } from './components/Icons'
import Onboarding, { Settings } from './components/Setup'
import { isPhone } from './device'
import './App.css'
import './layout.css'
import './redesign.css'
import './theme.css'

const METHOD_TEXT = {
  pdf: msg('Text taken from your PDF on this device.'),
  nano: msg('Gemini Nano read your photo on this device. The photo was not uploaded.'),
  tesseract: msg('Your photo was read on this device. The photo was not uploaded.'),
}

function readRoute() {
  const [view = '', id] = window.location.hash.replace(/^#\/?/, '').split('/')
  return { view: view || 'home', id }
}

const LANGUAGE_KEY = 'kamarat.language'
const SETUP_KEY = 'kamarat.setup.v1'

function setupWasDone() {
  try {
    return localStorage.getItem(SETUP_KEY) === 'done'
  } catch {
    return false
  }
}

// The language saved last time, or the browser's own language if Kamarat has it.
function startLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY)
    if (saved && LANGUAGES.some((l) => l.name === saved)) return saved
  } catch {
    // no saved language
  }
  for (const tag of navigator.languages ?? []) {
    const base = tag.toLowerCase().split('-')[0]
    const found = LANGUAGES.find((l) => l.code.toLowerCase() === tag.toLowerCase() || l.code === base)
    if (found) return found.name
  }
  return 'English'
}

// How many screens back inside Kamarat the browser can go.
const historyIndex = () => window.history.state?.kamarat ?? 0

function Expired({ onAdd, onHome }) {
  return (
    <section className="card">
      <h1 className="flow-title" tabIndex={-1} data-step-heading>{t('Your letter is not here any more')}</h1>
      <p>
        {t('For your privacy, Kamarat does not keep the text of your letter or your hidden details when the page is reloaded or closed. Letters you kept are still in My papers.')}
      </p>
      <div className="buttons">
        <button className="primary" onClick={onAdd}>{t('Add a letter')}</button>
        <button className="secondary" onClick={onHome}>{t('Home')}</button>
      </div>
    </section>
  )
}

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const [text, setText] = useState('')
  const [language, setLanguageState] = useState(() => {
    const name = startLanguage()
    const lang = LANGUAGES.find((l) => l.name === name)
    // A translation saved earlier is used before the first paint.
    if (lang && primeUiTranslation(lang.code)) {
      document.documentElement.lang = lang.code
      document.documentElement.dir = lang.rtl ? 'rtl' : 'ltr'
    }
    return name
  })
  // Whether Kamarat's own texts are being translated, or could not be.
  const [uiStatus, setUiStatus] = useState({ code: 'en', state: 'ready' })
  const [uiRetry, setUiRetry] = useState(0)
  const [toastClosed, setToastClosed] = useState(false)
  // The first visit asks for the language and the country, once.
  const [setupDone, setSetupDone] = useState(setupWasDone)
  const scanInput = useRef(null)
  // Where the person lives: their own choice, or a guess from the browser.
  const [country, setCountryState] = useState(() => savedCountry() || guessCountry())
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

  function setLanguage(name) {
    setLanguageState(name)
    try {
      localStorage.setItem(LANGUAGE_KEY, name)
    } catch {
      // private mode: the choice lasts until the page is closed
    }
  }

  // Kamarat's own texts follow the chosen language. Arabic, Persian, Urdu and
  // the other right-to-left languages also turn the layout around.
  useEffect(() => {
    const lang = LANGUAGES.find((l) => l.name === language) ?? LANGUAGES[0]
    let cancelled = false
    const apply = (code, map, rtl) => {
      setUiTranslation(code, map)
      document.documentElement.lang = code
      document.documentElement.dir = rtl ? 'rtl' : 'ltr'
    }
    if (lang.code === 'en') {
      apply('en', null, false)
      setUiStatus({ code: 'en', state: 'ready' })
      return undefined
    }
    setUiStatus({ code: lang.code, state: 'loading' })
    loadUiTranslation(lang.name, lang.code, { isCancelled: () => cancelled })
      .then((map) => {
        if (cancelled) return
        apply(lang.code, map, lang.rtl)
        setUiStatus({ code: lang.code, state: 'ready' })
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('Could not translate the app:', err.message)
        apply('en', null, false)
        setUiStatus({ code: lang.code, state: 'failed' })
      })
    return () => {
      cancelled = true
    }
  }, [language, uiRetry])

  function finishSetup() {
    try {
      localStorage.setItem(SETUP_KEY, 'done')
    } catch {
      // private mode: asked again next time
    }
    setSetupDone(true)
    if (!country) saveCountry('')
  }

  // The round Scan button on phones opens the camera straight away.
  function scanNow() {
    if (isPhone()) scanInput.current?.click()
    else newLetter()
  }

  function setCountry(code) {
    setCountryState(code)
    saveCountry(code)
  }

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
        t('Start a new letter? The letter you have open is not kept in My papers, so its explanation will close.'),
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
    setReading(t('Opening the file on your device...'))
    try {
      const lang = LANGUAGES.find((l) => l.name === language)
      const { text: found, method, note, missing } = await readFile(file, setReading, readerLanguages(lang?.code, country))
      setText(found)
      setMessage({
        kind: missing ? 'warn' : 'check',
        text: `${t(METHOD_TEXT[method] ?? METHOD_TEXT.pdf)} ${note} ${t('Check that the text matches your letter, especially numbers and dates.')}`.replace(/\s+/g, ' '),
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
      else setMessage({ kind: 'warn', text: t('The clipboard is empty. Copy the text of your letter first.') })
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
        setProgress(t('Starting private on-device AI...'))
        await detectorModel.initializeDeviceModel((value) =>
          setProgress(t('Downloading on-device AI: {percent}%', { percent: Math.round(value * 100) })),
        )
        setProgress(t('Looking for personal details on your device...'))
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
    { id: 'home', label: t('Home'), icon: HomeIcon, onClick: () => go('') },
    { id: 'new', label: t('New letter'), phoneLabel: t('Scan'), icon: PlusIcon, phoneIcon: CameraIcon, onClick: scanNow },
    { id: 'papers', label: t('My papers'), icon: FolderIcon, onClick: () => go('papers'), count: papers.length },
  ]
  const langInfo = LANGUAGES.find((l) => l.name === language) ?? LANGUAGES[0]
  const localeText = `${langInfo.code.slice(0, 2).toUpperCase()}${country ? ` · ${country}` : ''}`

  if (!setupDone && !new URLSearchParams(window.location.search).has('eval')) {
    return (
      <div className="app app-setup">
        <Onboarding
          language={language}
          country={country}
          onLanguage={setLanguage}
          onCountry={setCountry}
          onDone={finishSetup}
          uiStatus={uiStatus.state === 'ready' ? '' : uiStatus.state}
          onRetry={() => setUiRetry((n) => n + 1)}
        />
      </div>
    )
  }
  const activeNav = inFlow || view === 'letter' ? 'new' : view

  return (
    <div className={`app ${inFlow ? 'in-flow' : ''}`}>
      <header className="top">
        <button className="brand" onClick={() => go('')} aria-label={t('Kamarat home')}>
          <Logo size={38} />
          <span className="wordmark">Kamarat</span>
        </button>

        <nav className="nav" aria-label={t('Main')}>
          {navItems.map(({ id, label, phoneLabel, icon: Icon, phoneIcon: PhoneIcon, onClick, count }) => (
            <button
              key={id}
              className={`nav-item nav-${id} ${activeNav === id ? 'active' : ''}`}
              aria-current={activeNav === id ? 'page' : undefined}
              onClick={onClick}
            >
              <span className="nav-icon"><Icon width={20} height={20} /></span>
              {PhoneIcon && <span className="nav-icon-phone"><PhoneIcon width={24} height={24} /></span>}
              <span className={phoneLabel ? 'label-desktop' : ''}>{label}</span>
              {phoneLabel && <span className="label-phone">{phoneLabel}</span>}
              {count > 0 && <span className="papers-count">{count}</span>}
            </button>
          ))}
        </nav>
        <input
          ref={scanInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) readLetterFile(file, { fresh: true })
          }}
        />

        <button
          className="locale-chip"
          onClick={() => go('settings')}
          aria-label={t('Language and country: {language}, {country}', { language, country: country || '-' })}
        >
          <GlobeIcon width={18} height={18} /> {localeText}
        </button>
      </header>

      <main className="main">
        {new URLSearchParams(window.location.search).has('eval') && <EvalPage />}
        {import.meta.env.DEV && new URLSearchParams(window.location.search).has('translations') && <TranslationsPage />}

        {/* Translating the screens: a small message at the bottom, never a banner. */}
        {uiStatus.state === 'loading' && (
          <p className="toast" role="status">Translating Kamarat into {language}...</p>
        )}
        {uiStatus.state === 'failed' && !toastClosed && (
          <p className="toast toast-warn" role="status">
            <span>Screens stay in English for now. Answers still come in {language}.</span>
            <button className="link-button" onClick={() => { setToastClosed(false); setUiRetry((n) => n + 1) }}>Try again</button>
            <button className="toast-close" onClick={() => setToastClosed(true)} aria-label="Close">×</button>
          </p>
        )}

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

        {view === 'settings' && (
          <Settings
            language={language}
            country={country}
            onLanguage={setLanguage}
            onCountry={setCountry}
            onBack={() => goBack('')}
          />
        )}

        {view === 'papers' && !route.id && <MyPapers onOpen={(id) => go(`papers/${id}`)} onNew={newLetter} />}
        {view === 'papers' && route.id && (
          <SavedLetter key={route.id} id={route.id} language={language} country={country} onBack={() => go('papers')} />
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
              country={country}
              onSavedChange={setLiveSavedId}
              onBack={() => go('check')}
              onHome={() => go('')}
            />
          </div>
        )}
      </main>

      <footer className="footer">
        {t('Kamarat explains letters. It is not legal advice. Built with Gemini Nano on your device and Gemini in the cloud, through Firebase AI Logic.')}
      </footer>
    </div>
  )
}
