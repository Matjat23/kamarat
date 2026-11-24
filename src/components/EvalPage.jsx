// Test bench, opened with ?eval in the address. Runs Kamarat's real privacy
// check (on-device AI when available, plus the pattern check) on the made-up
// notices from tools/make_test_notices.py, builds the exact text that would be
// sent, and offers results.json for tools/score.py. Nothing is sent anywhere.
import { useState } from 'react'
import { detectorModel, checkOnDeviceModel } from '../firebase'
import { detectWithAI, detectWithPatterns, mergeDetails, buildRedaction } from '../privacy'
import { Dots } from './Icons'

// Same rules as tools/score.py: a detail is protected when none of its parts
// (comma-separated, and every name word of three letters or more) is left in
// the payload.
const norm = (text) => text.toLowerCase().replace(/[\s,]+/g, ' ').trim()

function pieces(detail) {
  const parts = detail.text.split(',').map(norm).filter((p) => p.length >= 2)
  if (detail.type === 'NAME') {
    parts.push(...norm(detail.text).replace(/\./g, ' ').split(' ').filter((w) => w.length >= 3))
  }
  return [...new Set(parts)]
}

function isLeaked(detail, payload) {
  const text = norm(payload)
  return pieces(detail).some((piece) => {
    const escaped = piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'u').test(text)
  })
}

export default function EvalPage() {
  const [state, setState] = useState({ phase: 'idle' })

  async function run() {
    setState({ phase: 'running', done: 0 })
    const notices = await (await fetch('/eval/notices.json')).json()
    const ids = notices.map((n) => n.id)
    if (new Set(ids).size !== ids.length) {
      setState({ phase: 'error', message: 'notices.json has duplicate ids. Run tools/make_test_notices.py again.' })
      return
    }
    const status = await checkOnDeviceModel()
    const nano = status !== 'unavailable' && status !== 'unsupported'
    if (nano) {
      try {
        await detectorModel.initializeDeviceModel()
      } catch {
        // falls back to the pattern check below
      }
    }
    const runs = []
    let safe = 0
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
      const { shared } = buildRedaction(notice.text, details)
      const found = details.map((d) => ({ text: d.text, type: d.type, foundBy: d.foundBy }))
      runs.push({ id: notice.id, mode, found, payload: shared })
      for (const expected of notice.details) {
        total += 1
        if (!isLeaked(expected, shared)) safe += 1
      }
      setState({ phase: 'running', done: runs.length, of: notices.length })
    }
    const results = { browser: navigator.userAgent, ranAt: new Date().toISOString(), runs }
    const url = URL.createObjectURL(new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' }))
    const modes = [...new Set(runs.map((r) => r.mode))].join(', ')
    setState({ phase: 'done', url, safe, total, modes })
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
        Runs the privacy check on made-up notices with known personal details and checks the exact text
        that would be sent. Nothing is sent anywhere.
      </p>
      {state.phase === 'idle' && <button className="primary" onClick={run}>Run the test</button>}
      {state.phase === 'running' && (
        <p role="status"><Dots /> Checked {state.done} of {state.of ?? '...'} notices</p>
      )}
      {state.phase === 'error' && <p className="notice notice-warn" role="alert">{state.message}</p>}
      {state.phase === 'done' && (
        <>
          <p className="notice notice-ok" role="status">
            Kept {state.safe} of {state.total} personal details out of the shared text (
            {Math.round((state.safe / state.total) * 100)}%). Mode: {state.modes}.
          </p>
          <a className="button-link" href={state.url} download="results.json">Download results.json</a>
          <p className="small muted">Then run: python tools/score.py results.json</p>
        </>
      )}
    </section>
  )
}
