// Step 1: add the letter: a photo, a file or pasted text. Everything is read
// on this device; the file itself never leaves it.
import { useEffect, useRef } from 'react'
import { EXAMPLES } from '../examples'
import { MAX_NOTICE_LENGTH } from '../privacy'
import { isPhone } from '../device'
import FlowHead from './FlowHead'
import { t, msg } from '../i18n'
import { ClipboardIcon, DeviceIcon, ArrowIcon, CameraIcon, FileIcon, Dots, Flag } from './Icons'

const NANO_TEXT = {
  checking: msg('Checking for private on-device AI...'),
  available: msg('Private on-device AI is ready.'),
  downloadable: msg('Private on-device AI will download the first time (a few minutes).'),
  downloading: msg('Private on-device AI is downloading.'),
  unavailable: msg('Basic check here: you check names and addresses in the next step.'),
  unsupported: msg('Basic check here: you check names and addresses in the next step.'),
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
      <FlowHead step={1} title={t('Add your letter')} backLabel={t('Back')} onBack={onBack} />

      <div className="input-actions">
        <button className="secondary" onClick={() => (phone ? cameraInput : fileInput).current?.click()} disabled={working}>
          <CameraIcon /> {phone ? t('Take a photo') : t('Photo or PDF')}
        </button>
        {phone && (
          <button className="secondary" onClick={() => fileInput.current?.click()} disabled={working}>
            <FileIcon /> {t('File')}
          </button>
        )}
        <button className="secondary" onClick={onPaste} disabled={working}>
          <ClipboardIcon /> {t('Paste')}
        </button>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={picked} />
        <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={picked} />
      </div>

      <label htmlFor="notice-input" className="visually-hidden">{t('The text of your letter')}</label>
      <textarea
        id="notice-input"
        ref={textRef}
        className="letter-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('The text of your letter appears here. You can also type or paste it.')}
        rows={phone ? 9 : 12}
        disabled={working}
        dir="auto"
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
          <span className="small muted">{t('No letter at hand? Try an example:')}</span>
          {EXAMPLES.map((example) => (
            <button key={example.id} className="chip-button secondary" onClick={() => onExample(example)}>
              <Flag country={example.country} /> {example.sender}
            </button>
          ))}
        </div>
      )}

      <p className={`small ${tooLong ? 'warning-text' : 'muted'}`} role={tooLong ? 'alert' : undefined}>
        {tooLong ? (
          t('Too long for on-device AI. Keep the main part (under {count} characters).', {
            count: MAX_NOTICE_LENGTH.toLocaleString(),
          })
        ) : (
          <>
            <DeviceIcon width={14} height={14} /> {t(NANO_TEXT[nanoStatus] ?? nanoStatus)} {t('Nothing has been sent anywhere.')}
          </>
        )}
      </p>

      <div className="action-bar is-sticky">
        <button className="primary wide big" onClick={onFind} disabled={working || !text.trim() || tooLong}>
          {busy ? (
            <span role="status">
              <Dots /> {progress || t('Looking on your device...')}
            </span>
          ) : (
            <>
              {t('Next: check what is private')} <ArrowIcon className="arrow-forward" />
            </>
          )}
        </button>
      </div>
    </section>
  )
}
