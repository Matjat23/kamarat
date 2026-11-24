// Step 1: get the notice in: paste it, scan a photo, or upload a PDF.
// Everything is read on this device; the file itself never leaves it.
import { useRef, useState } from 'react'
import { EXAMPLES } from '../examples'
import { MAX_NOTICE_LENGTH } from '../privacy'
import { isPhone, readClipboard } from '../device'
import { readFile } from '../scan'
import {
  LockIcon,
  QuoteIcon,
  LandmarkIcon,
  ClipboardIcon,
  DeviceIcon,
  ArrowIcon,
  CameraIcon,
  FileIcon,
  Dots,
  Flag,
} from './Icons'

const NANO_TEXT = {
  checking: 'Checking for private on-device AI...',
  available: 'Private on-device AI is ready on this computer.',
  downloadable: 'Private on-device AI will download the first time (a few minutes).',
  downloading: 'Private on-device AI is downloading.',
  unavailable: 'Basic check only here: review names and addresses yourself.',
  unsupported: 'Basic check only here: review names and addresses yourself.',
}

const PHONE_TEXT =
  'On a phone, Kamarat uses a basic check for numbers and emails. You review names and addresses yourself. On a computer with Chrome, Gemini Nano finds them for you.'

const TRUST = [
  { icon: LockIcon, title: 'You choose what is shared', text: 'Personal details are found on your device, and you decide what to hide before anything is sent.' },
  { icon: QuoteIcon, title: 'Every answer shows its source', text: 'Each step quotes the sentence in your letter it comes from.' },
  { icon: LandmarkIcon, title: 'Official sources only', text: 'Links come from a checked list of government pages.' },
]

const METHOD_TEXT = {
  pdf: 'Text taken from your PDF on this device.',
  nano: 'Gemini Nano read your photo on this device. The photo was not uploaded.',
  tesseract: 'Your photo was read on this device. The photo was not uploaded.',
}

export default function PasteStep({ text, setText, nanoStatus, busy, progress, onFind }) {
  const [message, setMessage] = useState(null)
  const [reading, setReading] = useState('')
  const cameraInput = useRef(null)
  const fileInput = useRef(null)
  const tooLong = text.length > MAX_NOTICE_LENGTH
  const noLocalAI = ['unsupported', 'unavailable'].includes(nanoStatus)
  const phone = isPhone()
  const working = busy || !!reading

  async function pasteFromClipboard() {
    setMessage(null)
    try {
      const copied = await readClipboard()
      if (copied.trim()) setText(copied)
      else setMessage({ kind: 'warn', text: 'The clipboard is empty. Copy the text of your notice first.' })
    } catch (err) {
      setMessage({ kind: 'warn', text: err.message })
    }
  }

  async function onFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setMessage(null)
    setReading('Opening the file on your device...')
    try {
      const { text: found, method } = await readFile(file, setReading)
      setText(found)
      setMessage({
        kind: 'check',
        text: `${METHOD_TEXT[method]} Check that the text matches your letter, especially numbers and dates, and fix anything that was misread.`,
      })
    } catch (err) {
      setMessage({ kind: 'warn', text: err.message })
    } finally {
      setReading('')
    }
  }

  return (
    <>
      <section className="hero">
        <h1 className="display">Understand your notice. Choose what you share.</h1>
        <p className="lead">
          Kamarat finds personal details on your device so you can hide them, then explains what
          the notice asks of you, in your language.
        </p>
        <ul className="trust trust-full">
          {TRUST.map(({ icon: Icon, title, text: body }) => (
            <li key={title}>
              <span className="trust-icon"><Icon /></span>
              <span>
                <strong>{title}</strong>
                <span className="trust-text">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        <details className="trust-compact">
          <summary>How your information is handled</summary>
          <ul>
            {TRUST.map(({ title, text: body }) => (
              <li key={title}>
                <strong>{title}.</strong> {body}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            <label htmlFor="notice-input">Your notice</label>
          </h2>
          <div className="input-actions">
            <button className="ghost" onClick={() => (phone ? cameraInput : fileInput).current?.click()} disabled={working}>
              {phone ? <CameraIcon /> : <FileIcon />} {phone ? 'Scan letter' : 'Photo or PDF'}
            </button>
            {phone && (
              <button className="ghost" onClick={() => fileInput.current?.click()} disabled={working}>
                <FileIcon /> File
              </button>
            )}
            <button className="ghost" onClick={pasteFromClipboard} disabled={working}>
              <ClipboardIcon /> Paste
            </button>
          </div>
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={onFile}
          />
          <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={onFile} />
        </div>

        {phone && noLocalAI && <p className="notice notice-warn small">{PHONE_TEXT}</p>}

        <textarea
          id="notice-input"
          className="letter-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the text of a letter, an email or a message from an agency, a university or a landlord. Or scan a photo or open a PDF."
          rows={phone ? 8 : 12}
          disabled={working}
          aria-describedby="notice-help"
        />

        {reading && (
          <p className="notice notice-ok small" role="status">
            <Dots /> {reading}
          </p>
        )}
        {message && (
          <p className={`notice small ${message.kind === 'warn' ? 'notice-warn' : 'notice-check'}`} role={message.kind === 'warn' ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}

        <p id="notice-help" className="small muted">
          {phone
            ? 'Tip: on iPhone you can also open a photo of the letter, press and hold the text, copy it and tap Paste.'
            : 'Photos and PDFs are read on this device and never uploaded.'}{' '}
          No paper letter at hand?{' '}
          <a href="/sample-letter.jpg" download="kamarat-sample-letter.jpg">
            Download a sample photo
          </a>{' '}
          (made-up details) and scan it.
        </p>

        <div className="examples">
          <span className="eyebrow">No letter at hand? Try an example</span>
          <div className="example-cards">
            {EXAMPLES.map((example) => (
              <button
                key={example.id}
                className="example-card"
                onClick={() => {
                  setText(example.text)
                  setMessage(null)
                }}
                disabled={working}
              >
                <Flag country={example.country} />
                <span>
                  <strong>{example.sender}</strong>
                  <span className="example-kind">{example.kind}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="status-row">
          <span className={`small ${tooLong ? 'warning-text' : 'muted'}`} role={tooLong ? 'alert' : undefined}>
            {tooLong
              ? `Too long for on-device AI. Keep the main part (under ${MAX_NOTICE_LENGTH.toLocaleString()} characters).`
              : text
                ? `${text.length.toLocaleString()} characters`
                : 'Nothing is sent anywhere yet.'}
          </span>
          {!(phone && noLocalAI) && (
            <span className={`nano-status nano-${nanoStatus}`}>
              <DeviceIcon width={16} height={16} /> {NANO_TEXT[nanoStatus] ?? nanoStatus}
            </span>
          )}
        </div>

        <div className={`action-bar ${text.trim() ? 'is-sticky' : ''}`}>
          <button
            className="primary wide big"
            onClick={onFind}
            disabled={working || !text.trim() || tooLong}
          >
            {busy ? (
              <span role="status">
                <Dots /> {progress || 'Looking on your device...'}
              </span>
            ) : (
              <>
                {noLocalAI ? 'Check for personal details' : 'Find my personal details'} <ArrowIcon />
              </>
            )}
          </button>
        </div>
      </section>
    </>
  )
}
