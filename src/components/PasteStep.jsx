// Step 1: paste a notice (or pick an example) and look for personal details.
import { useState } from 'react'
import { EXAMPLES } from '../examples'
import { MAX_NOTICE_LENGTH } from '../privacy'
import { isPhone, readClipboard } from '../device'
import { LockIcon, QuoteIcon, LandmarkIcon, ClipboardIcon, DeviceIcon, ArrowIcon, Dots, Flag } from './Icons'

const NANO_TEXT = {
  checking: 'Checking for private on-device AI...',
  available: 'Private on-device AI is ready on this computer.',
  downloadable: 'Private on-device AI will download the first time (a few minutes).',
  downloading: 'Private on-device AI is downloading.',
  unavailable: 'Private on-device AI is not available here. You can still hide details yourself.',
  unsupported: 'This browser has no on-device AI. You can still hide details yourself.',
}

const PHONE_TEXT =
  'On phones, private AI cannot run yet, so Kamarat uses its pattern check and you choose what else to hide. On a computer with Chrome, Gemini Nano finds your details for you.'

const TRUST = [
  { icon: LockIcon, title: 'Your details stay with you', text: 'Names and ID numbers are found and hidden on your device.' },
  { icon: QuoteIcon, title: 'Every answer shows its source', text: 'Each step quotes the sentence in your letter it comes from.' },
  { icon: LandmarkIcon, title: 'Official sources only', text: 'Links come from a checked list of government pages.' },
]

export default function PasteStep({ text, setText, nanoStatus, busy, progress, onFind }) {
  const [pasteError, setPasteError] = useState('')
  const tooLong = text.length > MAX_NOTICE_LENGTH
  const noLocalAI = ['unsupported', 'unavailable'].includes(nanoStatus)
  const phone = isPhone()

  async function pasteFromClipboard() {
    setPasteError('')
    try {
      const copied = await readClipboard()
      if (copied.trim()) setText(copied)
      else setPasteError('The clipboard is empty. Copy the text of your notice first.')
    } catch (err) {
      setPasteError(err.message)
    }
  }

  return (
    <>
      <section className="hero">
        <h1 className="display">Got a letter you don't fully understand?</h1>
        <p className="lead">
          Kamarat explains official notices in your language and tells you what to do next,
          without your name, ID number or address leaving your device.
        </p>
        <ul className="trust">
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
      </section>

      <section className="card paper">
        <div className="card-head">
          <h2>Paste your notice</h2>
          <button className="ghost" onClick={pasteFromClipboard} disabled={busy}>
            <ClipboardIcon /> Paste from clipboard
          </button>
        </div>

        {phone && noLocalAI && <p className="notice notice-warn small">{PHONE_TEXT}</p>}

        <textarea
          className="letter-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A letter, an email or a message from an agency, a university or a landlord. Paste the text here..."
          rows={phone ? 9 : 12}
          disabled={busy}
        />
        {pasteError && <p className="small warning-text">{pasteError}</p>}

        <div className="examples">
          <span className="eyebrow">No letter at hand? Try an example</span>
          <div className="example-cards">
            {EXAMPLES.map((example) => (
              <button
                key={example.id}
                className="example-card"
                onClick={() => setText(example.text)}
                disabled={busy}
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
          <span className={`small ${tooLong ? 'warning-text' : 'muted'}`}>
            {tooLong
              ? `Too long for on-device AI. Paste the main part (under ${MAX_NOTICE_LENGTH.toLocaleString()} characters).`
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

        <div className="action-bar">
          <button
            className="primary wide big"
            onClick={onFind}
            disabled={busy || !text.trim() || tooLong}
          >
            {busy ? (
              <>
                <Dots /> {progress || 'Looking on your device...'}
              </>
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
