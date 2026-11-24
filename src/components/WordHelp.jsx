// Read your notice with word help: every word can be tapped for a short,
// plain explanation. Hidden details stay as black bars and cannot be tapped.
import { useState } from 'react'
import { explainWord, sentenceAround } from '../words'
import { languageProps } from '../explain'
import { CloudIcon, DeviceIcon, Dots } from './Icons'

const LABEL = /(\[[A-Z]+_\d+\])/g
const WORD = /(\p{L}[\p{L}\p{M}'’-]*)/gu

export default function WordHelp({ shared, language }) {
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(null)

  async function ask(word, index) {
    const sentence = sentenceAround(shared, index)
    setHelp({ word, loading: true })
    try {
      const answer = await explainWord(word, sentence, language)
      setHelp({ word, ...answer })
    } catch (err) {
      setHelp({ word, error: 'Kamarat could not explain this word right now. Try again in a minute.' })
      console.warn(err)
    }
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
        <span className="small muted">Tap any word in your notice to get it explained in {language}.</span>
      </div>
      <button className="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Close the notice' : 'Read my notice with word help'}
      </button>

      {open && (
        <div className="word-text" dir="auto">
          {pieces.map((p, i) =>
            p.kind === 'label' ? (
              <span key={i} className="redact" title={p.text}>
                <span className="redact-label">{p.text.slice(1, -1).replace('_', ' ')}</span>
              </span>
            ) : p.kind === 'word' && p.text.length > 2 ? (
              <button
                key={i}
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
