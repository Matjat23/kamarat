// Read your notice with word help: tap a word, or type it, for a short plain
// explanation. Hidden details stay as black bars and cannot be picked.
// The screen says exactly what is sent and where.
import { useRef, useState } from 'react'
import { explainWord, sentenceAround, findWord } from '../words'
import { languageProps, LANGUAGES } from '../explain'
import { wordHelpRunsOnDevice } from '../firebase'
import { CloudIcon, DeviceIcon, Dots } from './Icons'

const LABEL = /(\[[A-Z]+_\d+\])/g
const WORD = /(\p{L}[\p{L}\p{M}'’-]*)/gu

export default function WordHelp({ shared, language }) {
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(null)
  const [typed, setTyped] = useState('')
  const [wordOnly, setWordOnly] = useState(false)
  // Only the latest lookup may show its answer, even if an older one finishes later.
  const latest = useRef(0)

  const code = LANGUAGES.find((l) => l.name === language)?.code ?? 'en'
  const onDevice = wordHelpRunsOnDevice(code)
  const what = wordOnly ? 'only the word' : 'the word and the sentence it is in'

  async function ask(word, index) {
    const sentence = !wordOnly && index >= 0 ? sentenceAround(shared, index) : ''
    const request = ++latest.current
    setHelp({ word, loading: true })
    try {
      const answer = await explainWord(word, sentence, language)
      if (request === latest.current) setHelp({ word, ...answer })
    } catch (err) {
      console.warn(err)
      if (request !== latest.current) return
      setHelp({
        word,
        error: err.quota ? err.message + '.' : 'Kamarat could not explain this word right now. Try again in a minute.',
      })
    }
  }

  function askTyped(event) {
    event.preventDefault()
    const word = typed.trim()
    if (!word || /\[[A-Z]+_\d+\]/.test(word)) return
    ask(word, findWord(shared, word))
  }

  // Splits the text into labels, words and the rest, keeping each word's position.
  const pieces = []
  let offset = 0
  for (const part of shared.split(LABEL)) {
    if (/^\[[A-Z]+_\d+\]$/.test(part)) {
      pieces.push({ kind: 'label', text: part })
    } else {
      let last = 0
      for (const m of part.matchAll(WORD)) {
        if (m.index > last) pieces.push({ kind: 'text', text: part.slice(last, m.index) })
        pieces.push({ kind: 'word', text: m[0], at: offset + m.index })
        last = m.index + m[0].length
      }
      if (last < part.length) pieces.push({ kind: 'text', text: part.slice(last) })
    }
    offset += part.length
  }

  return (
    <div className="group word-help">
      <div className="group-head">
        <span className="group-dot dot-green" aria-hidden="true" />
        <h3>Words you don't know?</h3>
        <span className="small muted">Tap or type a word from your notice to get it explained in {language}.</span>
      </div>
      <button className="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Close the notice' : 'Read my notice with word help'}
      </button>

      {open && (
        <>
          <p className="small muted word-privacy">
            {onDevice
              ? `Kamarat gives ${what} to Gemini Nano on your device. If Nano is not ready, cloud Gemini answers instead.`
              : `For ${language}, word help uses cloud Gemini. Kamarat sends ${what}.`}{' '}
            It always comes from the text you approved, so hidden details stay hidden.
          </p>
          <label className="check-line small">
            <input type="checkbox" checked={wordOnly} onChange={(e) => setWordOnly(e.target.checked)} />
            Send only the word, not its sentence (the answer may be less precise)
          </label>

          <form className="word-form" onSubmit={askTyped}>
            <label htmlFor="word-lookup" className="small">Type a word</label>
            <input
              id="word-lookup"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="secondary small-btn" type="submit" disabled={!typed.trim()}>Explain</button>
          </form>

          <div className="word-text" dir="auto">
            {pieces.map((p, i) =>
              p.kind === 'label' ? (
                <span key={i} className="redact" title={p.text}>
                  <span className="redact-label">{p.text.slice(1, -1).replace('_', ' ')}</span>
                </span>
              ) : p.kind === 'word' && p.text.length >= 2 ? (
                // Not in the tab order: a notice has hundreds of words. Keyboard
                // users type the word in the field above instead.
                <button
                  key={i}
                  tabIndex={-1}
                  className={`word ${help?.word === p.text ? 'word-active' : ''}`}
                  onClick={() => ask(p.text, p.at)}
                >
                  {p.text}
                </button>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </div>
        </>
      )}

      {open && help && (
        <div className="word-sheet" role="status" aria-live="polite">
          <div className="row-between">
            <strong className="word-title">{help.word}</strong>
            <button className="ghost small-btn" onClick={() => setHelp(null)} aria-label="Close word help">
              Close
            </button>
          </div>
          {help.loading && (
            <p className="small muted">
              <Dots /> Looking it up...
            </p>
          )}
          {help.error && <p className="small warning-text">{help.error}</p>}
          {help.text && (
            <>
              <p {...languageProps(language)}>{help.text}</p>
              {help.source === 'on_device' ? (
                <span className="badge badge-on_device"><DeviceIcon width={14} height={14} /> Explained on your device</span>
              ) : (
                <span className="badge badge-in_cloud"><CloudIcon width={14} height={14} /> Explained in the cloud</span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
