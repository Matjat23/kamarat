// Step 1: add the letter: a photo, a file or pasted text. Everything is read
// on this device; the file itself never leaves it.
import { useEffect, useRef } from 'react'
import { EXAMPLES } from '../examples'
import { MAX_NOTICE_LENGTH } from '../privacy'
import { isPhone } from '../device'
import FlowHead from './FlowHead'
import { ClipboardIcon, DeviceIcon, ArrowIcon, CameraIcon, FileIcon, Dots, Flag } from './Icons'

const NANO_TEXT = {
  checking: 'Checking for private on-device AI...',
  available: 'Private on-device AI is ready.',
  downloadable: 'Private on-device AI will download the first time (a few minutes).',
  downloading: 'Private on-device AI is downloading.',
  unavailable: 'Basic check here: you check names and addresses in the next step.',
  unsupported: 'Basic check here: you check names and addresses in the next step.',
}

export default function AddLetter({
  text,
  setText,
  nanoStatus,
  reading,
  message,
  onFile,
  onPaste,
  onExample,
  busy,
  progress,
  onFind,
  onBack,
  focusText,
}) {
  const cameraInput = useRef(null)
  const fileInput = useRef(null)
  const textRef = useRef(null)
  const tooLong = text.length > MAX_NOTICE_LENGTH
  const phone = isPhone()
  const working = busy || !!reading

  useEffect(() => {
    if (focusText) textRef.current?.focus()
  }, [focusText])

  function picked(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFile(file)
  }

  return (
    <section className="card flow-card">
      <FlowHead step={1} title="Add your letter" backLabel="Home" onBack={onBack} />

      <div className="input-actions">
        <button className="secondary" onClick={() => (phone ? cameraInput : fileInput).current?.click()} disabled={working}>
          <CameraIcon /> {phone ? 'Take a photo' : 'Photo or PDF'}
        </button>
        {phone && (
          <button className="secondary" onClick={() => fileInput.current?.click()} disabled={working}>
            <FileIcon /> File
          </button>
        )}
        <button className="secondary" onClick={onPaste} disabled={working}>
          <ClipboardIcon /> Paste
        </button>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={picked} />
        <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={picked} />
      </div>

      <label htmlFor="notice-input" className="visually-hidden">The text of your letter</label>
      <textarea
        id="notice-input"
        ref={textRef}
        className="letter-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="The text of your letter appears here. You can also type or paste it."
        rows={phone ? 9 : 12}
        disabled={working}
      />

      {reading && (
        <p className="notice notice-ok small" role="status">
          <Dots /> {reading}
        </p>
      )}
      {message && (
        <p
          className={`notice small ${message.kind === 'warn' ? 'notice-warn' : 'notice-check'}`}
          role={message.kind === 'warn' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}

      {!text && !working && (
        <div className="home-examples">
          <span className="small muted">No letter at hand? Try an example:</span>
          {EXAMPLES.map((example) => (
            <button key={example.id} className="chip-button secondary" onClick={() => onExample(example)}>
              <Flag country={example.country} /> {example.sender}
            </button>
          ))}
        </div>
      )}

      <p className={`small ${tooLong ? 'warning-text' : 'muted'}`} role={tooLong ? 'alert' : undefined}>
        {tooLong ? (
          `Too long for on-device AI. Keep the main part (under ${MAX_NOTICE_LENGTH.toLocaleString()} characters).`
        ) : (
          <>
            <DeviceIcon width={14} height={14} /> {NANO_TEXT[nanoStatus] ?? nanoStatus} Nothing has been sent anywhere.
          </>
        )}
      </p>

      <div className="action-bar is-sticky">
        <button className="primary wide big" onClick={onFind} disabled={working || !text.trim() || tooLong}>
          {busy ? (
            <span role="status">
              <Dots /> {progress || 'Looking on your device...'}
            </span>
          ) : (
            <>
              Next: check what is private <ArrowIcon />
            </>
          )}
        </button>
      </div>
    </section>
  )
}
