// Test bench, opened with ?eval in the address. Runs Kamarat's real privacy
// check (on-device AI when available, plus the pattern check) on the made-up
// notices from tools/make_test_notices.py, then offers results.json for
// tools/score.py. Nothing is sent anywhere.
import { useState } from 'react'
import { detectorModel, checkOnDeviceModel } from '../firebase'
import { detectWithAI, detectWithPatterns, mergeDetails } from '../privacy'
import { Dots } from './Icons'

export default function EvalPage() {
  const [state, setState] = useState({ phase: 'idle' })

  async function run() {
    setState({ phase: 'running', done: 0 })
    const notices = await (await fetch('/eval/notices.json')).json()
    const nano = (await checkOnDeviceModel()) !== 'unavailable' && (await checkOnDeviceModel()) !== 'unsupported'
    if (nano) {
      try {
        await detectorModel.initializeDeviceModel()
      } catch {
        // falls back to the pattern check below
      }
    }
    const runs = []
    let hit = 0
    let total = 0
    for (const notice of notices) {
      let aiItems = []
      let mode = 'pattern check only'
      if (nano) {
        try {
          aiItems = (await detectWithAI(detectorModel, notice.text)).items
          mode = 'on-device AI + pattern check'
        } catch {
          mode = 'pattern check only (AI failed)'
        }
      }
      const { details } = mergeDetails(notice.text, aiItems, detectWithPatterns(notice.text))
      const found = details.map((d) => ({ text: d.text, type: d.type, foundBy: d.foundBy }))
      runs.push({ id: notice.id, mode, found })
      for (const expected of notice.details) {
        total += 1
        const want = expected.text.toLowerCase().replace(/[\s,]+/g, ' ')
        if (found.some((f) => f.text.toLowerCase().replace(/[\s,]+/g, ' ').includes(want))) hit += 1
      }
      setState({ phase: 'running', done: runs.length, of: notices.length })
    }
    const results = { browser: navigator.userAgent, ranAt: new Date().toISOString(), runs }
    const url = URL.createObjectURL(new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' }))
    setState({ phase: 'done', url, hit, total, mode: runs[0]?.mode })
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">For testing</span>
          <h2>Kamarat test bench</h2>
        </div>
      </div>
      <p className="muted">
        Runs the privacy check on made-up notices with known personal details. Nothing is sent anywhere.
      </p>
      {state.phase === 'idle' && <button className="primary" onClick={run}>Run the test</button>}
      {state.phase === 'running' && (
        <p role="status"><Dots /> Checked {state.done} of {state.of ?? '...'} notices</p>
      )}
      {state.phase === 'done' && (
        <>
          <p className="notice notice-ok" role="status">
            Found {state.hit} of {state.total} personal details ({Math.round((state.hit / state.total) * 100)}%). Mode: {state.mode}.
          </p>
          <a className="button-link" href={state.url} download="results.json">Download results.json</a>
          <p className="small muted">Then run: python tools/score.py results.json</p>
        </>
      )}
    </section>
  )
}
