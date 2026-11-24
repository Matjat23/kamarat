// Kamarat's own texts (buttons, headings, help) in the person's language.
//
// Every text is written in English and wrapped in t(), for example
// t('My papers') or t('In {days} days', { days }). tools/extract_strings.py
// collects them into ui-strings.json.
//
// For another language, Gemini translates that list once, and the result is
// kept in this browser. Only these app texts are sent, never a letter or
// anything typed by the person. Until the translation is ready, or if it
// fails, Kamarat shows English.
import STRINGS from './ui-strings.json'
import { askCloudJSON, isTemporary } from './explain'

let current = { code: 'en', map: null }

export function t(text, vars) {
  const out = current.map?.[text] ?? text
  if (!vars) return out
  return out.replace(/\{(\w+)\}/g, (match, name) => (vars[name] ?? match))
}

// Marks a text kept in data (for example the worry levels) for translation.
// It is translated where it is shown, with t().
export const msg = (text) => text

export function uiLanguageCode() {
  return current.code
}

// The locale for writing dates on screen. English uses day-month order.
export function dateLocale() {
  return current.code === 'en' ? 'en-GB' : current.code
}

export function setUiTranslation(code, map) {
  current = { code, map }
}

// A short fingerprint of the English texts, so a cached translation is
// thrown away when the texts change.
function fingerprint() {
  let hash = 0
  for (const s of STRINGS) for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0
  return `${STRINGS.length}-${hash >>> 0}`
}

const cacheKey = (code) => `kamarat.ui.${code}.${fingerprint()}`

function cached(code) {
  try {
    const raw = localStorage.getItem(cacheKey(code))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const placeholders = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')

// Each text comes back with its number, so a mix-up in the order cannot swap
// the meaning of two buttons.
const SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: { i: { type: 'integer' }, text: { type: 'string' } },
    required: ['i', 'text'],
  },
}

const SYSTEM = `You translate the interface of Kamarat, a calm, friendly web app that helps newcomers understand official letters. Translate each English text into the requested language. Use plain, warm, everyday words that a person new to the country understands. Keep it short, like app buttons and headings. Keep words in curly braces, like {days}, exactly as they are. Keep "Kamarat", "Gemini", "Gemini Nano", "Google" and "Firebase" unchanged. Answer with a JSON array of objects { "i": number, "text": translation }, one for every text, using the same number "i" as the English text.`

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Gemini sometimes answers "busy". Wait a moment and ask again, a few times.
async function askWithRetries(prompt, onStatus) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await askCloudJSON(SCHEMA, SYSTEM, prompt, onStatus)
    } catch (err) {
      if (attempt >= 2 || err.quota || !isTemporary(err)) throw err
      // On a per-minute limit Google says how long to wait ("retry in 34s").
      const asked = Number(/retry in ([\d.]+)s/i.exec(err.message ?? '')?.[1])
      await wait(asked ? Math.min(asked + 1, 45) * 1000 : 3000 * (attempt + 1))
    }
  }
}

const partialKey = (code) => `${cacheKey(code)}.partial`

function readPartial(code) {
  try {
    return JSON.parse(localStorage.getItem(partialKey(code)) ?? '{}')
  } catch {
    return {}
  }
}

function savePartial(code, map) {
  try {
    localStorage.setItem(partialKey(code), JSON.stringify(map))
  } catch {
    // private mode: progress is kept until the page closes
  }
}

export class Cancelled extends Error {}

// Translates every text that is not translated yet, about 120 at a time.
// Finished parts are kept, so a retry continues where it stopped. isCancelled
// is checked between parts, so choosing another language stops this one.
export async function translateAll(language, onStatus = () => {}, { code = '', isCancelled = () => false } = {}) {
  const map = code ? readPartial(code) : {}
  const todo = STRINGS.filter((english) => !map[english])
  for (let start = 0; start < todo.length; start += 120) {
    if (isCancelled()) throw new Cancelled()
    const batch = todo.slice(start, start + 120)
    const numbered = batch.map((text, i) => ({ i, text }))
    const prompt = `Language: ${language}\n\nTexts:\n${JSON.stringify(numbered)}`
    const result = await askWithRetries(prompt, onStatus)
    const raw = result.response.text()
    const list = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1))
    let good = 0
    for (const item of Array.isArray(list) ? list : []) {
      const english = batch[item?.i]
      const translated = typeof item?.text === 'string' ? item.text.trim() : ''
      // A translation that lost a {placeholder} would show wrong numbers, so
      // that one text stays in English.
      if (english && translated && placeholders(translated) === placeholders(english)) {
        map[english] = translated
        good += 1
      }
    }
    // A part that came back mostly empty or broken counts as failed.
    if (good < batch.length * 0.9) throw new Error('The translation came back incomplete')
    if (code) savePartial(code, map)
  }
  return map
}

// A translation shipped with the app (public/i18n/<code>.json), if there is
// one. Only texts that still exist in English are used.
async function shipped(code) {
  try {
    const response = await fetch(`/i18n/${code}.json`)
    if (!response.ok) return null
    const data = await response.json()
    const map = {}
    for (const english of STRINGS) {
      const translated = data[english]
      if (typeof translated === 'string' && placeholders(translated) === placeholders(english)) map[english] = translated
    }
    // Only worth using if it covers most of the app.
    return Object.keys(map).length >= STRINGS.length * 0.8 ? map : null
  } catch {
    return null
  }
}

// Uses a translation already saved in this browser straight away, so the page
// does not flash in English first. Returns true when one was found.
export function primeUiTranslation(code) {
  const saved = code && code !== 'en' ? cached(code) : null
  if (saved) setUiTranslation(code, saved)
  return Boolean(saved)
}

// Returns the translation for a language: from this browser, from the files
// shipped with the app, or from Gemini.
export async function loadUiTranslation(language, code, { onStatus = () => {}, isCancelled = () => false } = {}) {
  if (code === 'en') return null
  const saved = cached(code)
  if (saved) return saved
  const map = (await shipped(code)) ?? (await translateAll(language, onStatus, { code, isCancelled }))
  // Only a translation that covers nearly everything is kept.
  if (Object.keys(map).length < STRINGS.length * 0.9) throw new Error('The translation is incomplete')
  try {
    localStorage.setItem(cacheKey(code), JSON.stringify(map))
    localStorage.removeItem(partialKey(code))
  } catch {
    // private mode: translated again next time
  }
  return map
}
