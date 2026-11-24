// Home: Kamarat says hello, shows what is coming up from saved letters, and
// offers one clear way in: take a photo, upload a file or paste the text.
import { useRef } from 'react'
import { upcomingDeadlines } from '../papers'
import { daysUntil } from '../worry'
import { EXAMPLES } from '../examples'
import { isPhone } from '../device'
import { languageProps } from '../explain'
import { COUNTRIES } from '../countries'
import { Logo, CameraIcon, FileIcon, ClipboardIcon, ArrowIcon, LockIcon, Flag } from './Icons'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 5) return 'Hello'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function whenText(date) {
  const days = daysUntil(date)
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} ago`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

const HOW = [
  { title: 'Add your letter', text: 'Take a photo, upload a PDF or paste the text.' },
  { title: 'Check what is private', text: 'Your personal details are found and hidden on your device.' },
  { title: 'Know what to do', text: 'Clear steps, dates and answers, in your language.' },
]

export default function Home({ papers, country, onCountry, onResume, onFile, onPaste, onExample, onOpenPaper, onOpenPapers }) {
  const cameraInput = useRef(null)
  const fileInput = useRef(null)
  const phone = isPhone()
  const { dated, unknown } = upcomingDeadlines(papers)

  function picked(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFile(file)
  }

  return (
    <div className="home">
      <section className="home-hello">
        <Logo size={56} />
        <div>
          <h1 className="home-title" tabIndex={-1} data-step-heading>{greeting()}, I'm Kamarat.</h1>
          <p className="lead">
            Show me an official letter and I'll tell you what it means and what to do, in your language.
            Your personal details stay on your device.
          </p>
        </div>
      </section>

      <label className="home-country">
        <span>Where do you live?</span>
        <select value={country} onChange={(e) => onCountry(e.target.value)}>
          <option value="">Choose a country</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        <span className="small muted">So Kamarat can find the right official pages and count working days the right way.</span>
      </label>

      {onResume && (
        <button className="home-card resume" onClick={onResume}>
          <span>
            <strong>Continue with your letter</strong>
            <span className="small muted">The explanation is still open.</span>
          </span>
          <ArrowIcon />
        </button>
      )}

      {(dated.length > 0 || unknown.length > 0) && (
        <section className="home-card">
          <div className="row-between">
            <h2 className="home-card-title">Coming up</h2>
            <button className="link-button" onClick={onOpenPapers}>All my papers</button>
          </div>
          <ul className="coming-list">
            {dated.slice(0, 3).map(({ paper, action, date }) => (
              <li key={`${paper.id}-${action.index}`}>
                <button className="coming-item" onClick={() => onOpenPaper(paper.id)}>
                  <span className={`coming-when ${daysUntil(date) <= 7 ? 'is-soon' : ''}`}>{whenText(date)}</span>
                  <span className="coming-body">
                    <strong {...languageProps(paper.language)}>{action.title}</strong>
                    <span className="small muted">{paper.sender}</span>
                  </span>
                  <ArrowIcon width={18} height={18} />
                </button>
              </li>
            ))}
            {unknown.length > 0 && (
              <li>
                <button className="coming-item" onClick={() => onOpenPaper(unknown[0].paper.id)}>
                  <span className="coming-when">Date not known</span>
                  <span className="coming-body">
                    <strong {...languageProps(unknown[0].paper.language)}>{unknown[0].action.title}</strong>
                    <span className="small muted">Tell Kamarat when you got the letter</span>
                  </span>
                  <ArrowIcon width={18} height={18} />
                </button>
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="home-card home-start">
        <h2 className="home-card-title">Got a letter?</h2>
        <div className="start-tiles">
          <button className="start-tile start-main" onClick={() => (phone ? cameraInput : fileInput).current?.click()}>
            <CameraIcon width={28} height={28} />
            <strong>{phone ? 'Take a photo' : 'Photo or PDF'}</strong>
            <span className="small">Read on your device, never uploaded</span>
          </button>
          {phone && (
            <button className="start-tile" onClick={() => fileInput.current?.click()}>
              <FileIcon width={26} height={26} />
              <strong>Upload a file</strong>
              <span className="small muted">A photo or a PDF</span>
            </button>
          )}
          <button className="start-tile" onClick={onPaste}>
            <ClipboardIcon width={26} height={26} />
            <strong>Paste the text</strong>
            <span className="small muted">From an email or a website</span>
          </button>
        </div>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={picked} />
        <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={picked} />
        <div className="home-examples">
          <span className="small muted">No letter at hand? Try an example:</span>
          {EXAMPLES.map((example) => (
            <button key={example.id} className="chip-button secondary" onClick={() => onExample(example)}>
              <Flag country={example.country} /> {example.sender}
            </button>
          ))}
        </div>
      </section>

      <section className="home-how" aria-label="How it works">
        <ol>
          {HOW.map((step, i) => (
            <li key={step.title}>
              <span className="how-number" aria-hidden="true">{i + 1}</span>
              <span>
                <strong>{step.title}</strong>
                <span className="small muted">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="small muted home-promise">
          <LockIcon width={16} height={16} /> No account needed. Kamarat explains letters; it is not legal advice.
        </p>
        <p className="small muted">
          Answers come in the language you pick at the top. Kamarat's own buttons are in English for now.
        </p>
      </section>
    </div>
  )
}
