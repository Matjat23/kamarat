// "My papers": a private folder that lives only in this browser.
// It keeps the explanation and the approved text (with hidden details as labels),
// never the original letter and never the hidden details themselves.
// Nothing here is sent anywhere.
//
// Deadlines are stored the way the notice states them (a date, or "30 days
// after you received it") together with the notice date and the day the person
// received it, all as YYYY-MM-DD. The dates are worked out again every time the
// paper is opened, with the same code as the explanation screen.
import { resolveDeadline, quoteIsInText, parseDay } from './explain'
import { hostOf, isOfficialDomain } from './officialDomains'

const KEY = 'kamarat.papers.v1'

// Sent on window whenever My papers changes, so every open screen stays in step.
export const PAPERS_CHANGED = 'kamarat-papers-changed'

function announce() {
  window.dispatchEvent(new Event(PAPERS_CHANGED))
}
const KINDS = ['MUST', 'CAN', 'UNCLEAR']
const DEADLINE_KINDS = ['NONE', 'FIXED_DATE', 'AFTER_RECEIVING', 'AFTER_NOTICE_DATE', 'AFTER_OTHER_EVENT']

const text = (value) => (typeof value === 'string' ? value : '')
const day = (value) => (parseDay(value) ? value : '')

export function toDayString(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function cleanDeadline(deadline) {
  if (!deadline || !DEADLINE_KINDS.includes(deadline.kind)) return { kind: 'NONE' }
  return {
    kind: deadline.kind,
    date: day(deadline.date),
    amount: Number.isFinite(Number(deadline.amount)) ? Number(deadline.amount) : 0,
    unit: text(deadline.unit) || 'DAYS',
    event: text(deadline.event),
  }
}

// Checks a stored paper and fills in safe defaults. Returns null when it is
// not a paper at all, so a damaged entry can never break the page.
// Papers saved by the first version kept a computed date instead of the
// deadline itself; those dates are kept as fixed dates.
export function cleanPaper(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null
  const shared = text(raw.shared)
  const actions = (Array.isArray(raw.actions) ? raw.actions : [])
    .filter((a) => a && typeof a === 'object')
    .map((a) => {
      let deadline = cleanDeadline(a.deadline)
      if (!a.deadline && typeof a.date === 'string' && !Number.isNaN(Date.parse(a.date))) {
        deadline = { kind: 'FIXED_DATE', date: toDayString(new Date(a.date)), amount: 0, unit: 'DAYS', event: '' }
      }
      const quote = text(a.quote)
      return {
        title: text(a.title) || 'Untitled step',
        explanation: text(a.explanation),
        kind: KINDS.includes(a.kind) ? a.kind : 'UNCLEAR',
        quote,
        quoteFound: typeof a.quoteFound === 'boolean' ? a.quoteFound : quoteIsInText(quote, shared),
        deadline,
      }
    })
  const worry = raw.worry && typeof raw.worry === 'object' ? raw.worry : null
  return {
    id: raw.id,
    savedAt: Number.isNaN(Date.parse(raw.savedAt)) ? new Date().toISOString() : raw.savedAt,
    sender: text(raw.sender) || 'Unknown sender',
    summary: text(raw.summary),
    language: text(raw.language) || 'English',
    worry: worry && {
      level: text(worry.level),
      reason: text(worry.reason),
      quote: text(worry.quote),
      quoteFound: typeof worry.quoteFound === 'boolean' ? worry.quoteFound : quoteIsInText(worry.quote, shared),
    },
    noticeDate: day(raw.noticeDate),
    country: /^[A-Z]{2}$/.test(raw.country ?? '') ? raw.country : '',
    receivedDate: day(raw.receivedDate),
    shared,
    done: (Array.isArray(raw.done) ? raw.done : []).filter((i) => Number.isInteger(i) && i >= 0 && i < actions.length),
    actions,
    pages: (Array.isArray(raw.pages) ? raw.pages : []).filter((p) => typeof p === 'string'),
    sites: (Array.isArray(raw.sites) ? raw.sites : [])
      .filter((s) => s && typeof s === 'object')
      .map((s) => ({ name: text(s.name), why: text(s.why), domain: hostOf(text(s.domain)) }))
      .filter((s) => isOfficialDomain(s.domain)),
  }
}

export function listPapers() {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.map(cleanPaper).filter(Boolean) : []
  } catch {
    return []
  }
}

function store(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    announce()
    return true
  } catch {
    return false
  }
}

export function savePaper(paper) {
  const clean = cleanPaper(paper)
  if (!clean) return false
  const list = listPapers().filter((p) => p.id !== clean.id)
  return store([clean, ...list])
}

export function updatePaper(id, patch) {
  const list = listPapers()
  const index = list.findIndex((p) => p.id === id)
  if (index === -1) return false
  const next = cleanPaper({ ...list[index], ...patch })
  if (!next) return false
  list[index] = next
  return store(list)
}

export function deletePaper(id) {
  return store(listPapers().filter((p) => p.id !== id))
}

export function deleteAllPapers() {
  try {
    localStorage.removeItem(KEY)
    announce()
    return true
  } catch {
    return false
  }
}

// Steps with their deadlines worked out. Used by the letter screen for new and
// saved letters alike. Steps whose quote was not found go to CHECK.
export function prepareActions(actions, { noticeDate, receivedDate, done = [], country = '' }) {
  const doneSet = new Set(done)
  return actions.map((action, index) => ({
    ...action,
    index,
    group: action.quoteFound ? action.kind : 'CHECK',
    done: doneSet.has(index),
    info: resolveDeadline(action.deadline, { noticeDate, receivedDate, quote: action.quote, country }),
  }))
}

export function paperActions(paper) {
  return prepareActions(paper.actions, paper)
}

// Open steps across every saved paper: the ones with a known date (soonest
// first) and the ones whose date Kamarat cannot work out yet.
export function upcomingDeadlines(papers) {
  const dated = []
  const unknown = []
  for (const paper of papers) {
    for (const action of paperActions(paper)) {
      if (action.group === 'CHECK' || action.done || !action.info) continue
      if (action.info.date) dated.push({ paper, action, date: action.info.date })
      else unknown.push({ paper, action })
    }
  }
  dated.sort((a, b) => a.date - b.date)
  return { dated, unknown }
}
