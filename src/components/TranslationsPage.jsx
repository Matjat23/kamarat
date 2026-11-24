// Developer page, opened with ?translations while running `npm run dev`.
// Translates Kamarat's screens into the chosen languages with Gemini and saves
// each one into public/i18n, so the app can use it without asking Gemini.
// Check a translation before relying on it, especially in languages you know.
import { useState } from 'react'
import { LANGUAGES, languageLabel } from '../explain'
import { translateAll } from '../i18n'

const MAIN = ['sv', 'fr', 'es', 'de', 'ar', 'fa', 'uk', 'tr', 'so', 'ti', 'wo', 'pt', 'ru', 'zh', 'hi', 'ur']

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default function TranslationsPage() {
  const [chosen, setChosen] = useState(() => new Set(MAIN))
  const [log, setLog] = useState([])
  const [running, setRunning] = useState(false)
  const add = (line) => setLog((list) => [...list, line])

  async function run() {
    setRunning(true)
    for (const lang of LANGUAGES.filter((l) => chosen.has(l.code) && l.code !== 'en')) {
      add(`${lang.name}: translating...`)
      try {
        const map = await translateAll(lang.name, () => {}, { code: lang.code })
        const response = await fetch('/__save-translation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: lang.code, map }),
        })
        add(`${lang.name}: ${response.ok ? `saved ${Object.keys(map).length} texts` : await response.text()}`)
      } catch (err) {
        add(`${lang.name}: failed (${err.message.slice(0, 120)})`)
      }
      // Stay under the free plan's limit of 15 requests a minute.
      await wait(15000)
    }
    add('Done.')
    setRunning(false)
  }

  if (!import.meta.env.DEV) return <p>Only available while developing.</p>

  return (
    <section className="card">
      <h2>Translate Kamarat's screens</h2>
      <div className="home-examples">
        {LANGUAGES.filter((l) => l.code !== 'en').map((l) => (
          <label key={l.code} className="check-line small">
            <input
              type="checkbox"
              checked={chosen.has(l.code)}
              onChange={() =>
                setChosen((set) => {
                  const next = new Set(set)
                  if (next.has(l.code)) next.delete(l.code)
                  else next.add(l.code)
                  return next
                })
              }
            />
            {languageLabel(l)}
          </label>
        ))}
      </div>
      <button className="primary" onClick={run} disabled={running}>Translate and save</button>
      <pre className="small">{log.join('\n')}</pre>
    </section>
  )
}
