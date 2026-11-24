// Step 1: paste a notice (or pick an example) and look for personal details.
import { EXAMPLES } from '../examples'
import { MAX_NOTICE_LENGTH } from '../privacy'

const NANO_TEXT = {
  checking: 'Checking for private on-device AI...',
  available: 'Private on-device AI is ready.',
  downloadable: 'Private on-device AI will download the first time (a few minutes).',
  downloading: 'Private on-device AI is downloading.',
  unavailable: 'Private on-device AI is not available here. You can still hide details yourself.',
  unsupported: 'This browser has no on-device AI. You can still hide details yourself.',
}

export default function PasteStep({ text, setText, nanoStatus, busy, progress, onFind }) {
  const tooLong = text.length > MAX_NOTICE_LENGTH

  return (
    <section className="card">
      <h2>Paste your notice</h2>
      <p className="muted">
        A letter, an email or a message from an agency, a university or a landlord.
        It stays on this device until you approve what to share.
      </p>

      <div className="examples">
        <span className="muted small">Try an example:</span>
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

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the text of your notice here..."
        rows={14}
        disabled={busy}
      />

      <div className="row-between">
        <span className={`small ${tooLong ? 'warning-text' : 'muted'}`}>
          {tooLong
            ? `Too long for on-device AI. Paste the main part (under ${MAX_NOTICE_LENGTH.toLocaleString()} characters).`
            : `${text.length.toLocaleString()} characters`}
        </span>
        <span className="small muted">{NANO_TEXT[nanoStatus] ?? nanoStatus}</span>
      </div>

      <button
        className="primary"
        onClick={onFind}
        disabled={busy || !text.trim() || tooLong}
      >
        {busy ? progress || 'Looking on your device...' : 'Find my personal details'}
      </button>
    </section>
  )
}
