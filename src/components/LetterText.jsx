// The "Letter" tab: the text Kamarat sent, with hidden details as black bars.
// Tap any word, or type it, for a short plain explanation. When a step's
// "From your letter" link is used, the sentence is highlighted here.
import { useEffect, useId, useRef, useState } from 'react'
import { explainWord, sentenceAround, findWord } from '../words'
import { languageProps, LANGUAGES } from '../explain'
import { wordHelpRunsOnDevice } from '../firebase'
import { findQuote } from './Text'
import { CloudIcon, DeviceIcon, Dots } from './Icons'

const LABEL = /(\[[A-Z]+_\d+\])/g
const WORD = /(\p{L}[\p{L}\p{M}'’-]*)/gu

// Splits the letter into labels, words and the rest, keeping each position.
function splitLetter(shared) {
  const pieces = []
  let offset = 0
  for (const part of shared.split(LABEL)) {
    if (/^\[[A-Z]+_\d+\]$/.test(part)) {
      pieces.push({ kind: 'label', text: part, at: offset })
    } else {
      let last = 0
      for (const m of part.matchAll(WORD)) {
        if (m.index > last) pieces.push({ kind: 'text', text: part.slice(last, m.index), at: offset + last })
        pieces.push({ kind: 'word', text: m[0], at: offset + m.index })
        last = m.index + m[0].length
      }
      if (last < part.length) pieces.push({ kind: 'text', text: part.slice(last), at: offset + last })
    }
    offset += part.length
  }
  return pieces
}

export default function LetterText({ shared, language, highlight }) {
  const [help, setHelp] = useState(null)
  const [typed, setTyped] = useState('')
  const [wordOnly, setWordOnly] = useState(false)
  const latest = useRef(0)
  const firstMark = useRef(null)
  const uid = useId()

  const code = LANGUAGES.find((l) => l.name === language)?.code ?? 'en'
  const onDevice = wordHelpRunsOnDevice(code)
  const what = wordOnly ? 'only the word' : 'the word and its sentence'
  const range = highlight ? findQuote(shared, highlight.quote) : null

  useEffect(() => {
    firstMark.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlight])

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
        error: err.quota ? `${err.message}.` : 'Kamarat could not explain this word right now. Try again in a minute.',
      })
    }
  }

  function askTyped(event) {
    event.preventDefault()
    const word = typed.trim()
    if (!word || /\[[A-Z]+_\d+\]/.test(word)) return
    ask(word, findWord(shared, word))
  }

  let marked = false
  const inRange = (p) => range && p.at < range.end && p.at + p.text.length > range.start

  function render(p, i) {
    let node
    if (p.kind === 'label') {
      node = (
        <span key={i} className="redact" title={p.text}>
          <span className="redact-label">{p.text.slice(1, -1).replace('_', ' ')}</span>
        </span>
      )
    } else if (p.kind === 'word' && p.text.length >= 2) {
      // Not in the tab order: a letter has hundreds of words. Keyboard users
      // type the word in the field below instead.
      node = (
        <button
          key={i}
          tabIndex={-1}
          className={`word ${help?.word === p.text ? 'word-active' : ''}`}
          onClick={() => ask(p.text, p.at)}
        >
          {p.text}
        </button>
      )
    } else {
      node = <span key={i}>{p.text}</span>
    }
    if (!inRange(p)) return node
    const ref = marked ? undefined : firstMark
    marked = true
    return (
      <mark key={i} ref={ref} className="letter-mark">
        {node}
      </mark>
    )
  }

  return (
    <div className="letter-tab">
      <p className="small muted">
        This is exactly what Kamarat sent. Black bars are details that stayed on your device. Tap any word to
        have it explained in {language}.
      </p>
      {highlight && !range && (
        <p className="small warning-text">Kamarat could not find this sentence in your letter.</p>
      )}

      <div className="word-text" dir="auto">
        {splitLetter(shared).map(render)}
      </div>

      {help && (
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

      <form className="word-form" onSubmit={askTyped}>
        <label htmlFor={`${uid}-word`} className="small">Look up a word</label>
        <input
          id={`${uid}-word`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="secondary small-btn" type="submit" disabled={!typed.trim()}>Explain</button>
      </form>
      <details className="word-privacy">
        <summary className="small">What is sent when you look up a word</summary>
        <p className="small muted">
          {onDevice
            ? `Kamarat gives ${what} to Gemini Nano on your device. If Nano is not ready, cloud Gemini answers instead.`
            : `For ${language}, word help uses cloud Gemini. Kamarat sends ${what}.`}{' '}
          It always comes from the text you approved.
        </p>
        <label className="check-line small">
          <input type="checkbox" checked={wordOnly} onChange={(e) => setWordOnly(e.target.checked)} />
          Send only the word, not its sentence
        </label>
      </details>
    </div>
  )
}
