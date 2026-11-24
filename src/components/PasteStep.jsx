// Step 1: paste a notice (or pick an example) and look for personal details.
import { useState } from 'react'
import { EXAMPLES } from '../examples'
import { MAX_NOTICE_LENGTH } from '../privacy'
import { isPhone, readClipboard } from '../device'

const NANO_TEXT = {
  checking: 'Checking for private on-device AI...',
  available: 'Private on-device AI is ready.',
  downloadable: 'Private on-device AI will download the first time (a few minutes).',
  downloading: 'Private on-device AI is downloading.',
  unavailable: 'Private on-device AI is not available here. You can still hide details yourself.',
  unsupported: 'This browser has no on-device AI. You can still hide details yourself.',
}

const PHONE_TEXT =
  'On phones, private AI cannot run yet, so Kamarat uses its pattern check and you choose what else to hide. On a computer with Chrome, Gemini Nano finds your details for you.'

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
    <section className="card">
      <h2>Paste your notice</h2>
      <p className="muted">
        A letter, an email or a message from an agency, a university or a landlord.
        It stays on this device until you approve what to share.
      </p>

      {phone && noLocalAI && <p className="notice notice-warn small">{PHONE_TEXT}</p>}

      <div className="examples">
        <button className="chip-button chip-strong" onClick={pasteFromClipboard} disabled={busy}>
          Paste from clipboard
        </button>
        <span className="muted small">or try an example:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example.id}
            className="chip-button"
            onClick={() => setText(example.text)}
            disabled={busy}
          >
            {example.label}
          </button>
        ))}
      </div>
      {pasteError && <p className="small warning-text">{pasteError}</p>}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the text of your notice here..."
        rows={phone ? 9 : 14}
        disabled={busy}
      />

      <div className="row-between">
        <span className={`small ${tooLong ? 'warning-text' : 'muted'}`}>
          {tooLong
            ? `Too long for on-device AI. Paste the main part (under ${MAX_NOTICE_LENGTH.toLocaleString()} characters).`
            : `${text.length.toLocaleString()} characters`}
        </span>
        {!(phone && noLocalAI) && (
          <span className="small muted">{NANO_TEXT[nanoStatus] ?? nanoStatus}</span>
        )}
      </div>

      <div className="action-bar">
        <button
          className="primary wide"
          onClick={onFind}
          disabled={busy || !text.trim() || tooLong}
        >
          {busy
            ? progress || 'Looking on your device...'
            : noLocalAI
              ? 'Check for personal details'
              : 'Find my personal details'}
        </button>
      </div>
    </section>
  )
}
