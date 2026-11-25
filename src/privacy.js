// Finding and hiding personal details in a notice.
//
// The rule: the AI finds, the code decides.
// 1. Gemini Nano (on this device) lists personal details it sees.
// 2. Pattern checks catch things with a fixed shape (personal numbers, emails, phones).
// 3. The code keeps only details that really appear in the text, then replaces
//    them with labels like [NAME_1]. Dates, amounts and deadlines are never touched.
import { findNamesAndAddresses } from './namesAddresses.js'

export const TYPE_LABELS = {
  NAME: 'Name',
  ID: 'ID number',
  ADDRESS: 'Address',
  CASE: 'Case number',
  PHONE: 'Phone',
  EMAIL: 'Email',
  HIDDEN: 'Hidden by you',
}

// Long notices do not fit in the on-device model (about 9,000 tokens).
export const MAX_NOTICE_LENGTH = 12000

const DETECT_PROMPT = `You help people protect their privacy before they share an official letter.

Find every personal detail about the person the letter is written to, and about any other named private person, for example a case officer.

Personal details are:
- person names
- personal identity numbers and other ID numbers (student ID, passport, social security number, SEVIS ID)
- home addresses
- case or reference numbers
- phone numbers and email addresses

Do NOT include: dates, deadlines, amounts, fees, names of agencies, companies or universities, or website addresses.

Copy each detail exactly as it is written in the letter, character for character. Do not translate or reformat it.

Letter:
"""
{LETTER}
"""`

// Asks Gemini Nano for the list. Throws if the on-device model is not available,
// and also if its answer cannot be read, so a broken answer never looks like
// "no personal details found".
export async function detectWithAI(model, text) {
  const result = await model.generateContent(
    DETECT_PROMPT.replace('{LETTER}', text),
  )
  const items = parseDetailList(result.response.text())
  if (items === null) throw new Error('On-device detection returned an answer Kamarat could not read')
  return { items, source: result.response.inferenceSource }
}

function parseDetailList(raw) {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start === -1 || end === -1) return null
  try {
    const list = JSON.parse(raw.slice(start, end + 1))
    if (!Array.isArray(list)) return null
    return list.filter(
      (item) =>
        item &&
        typeof item.text === 'string' &&
        item.text.trim().length > 1 &&
        TYPE_LABELS[item.type],
    )
  } catch {
    return null
  }
}

// Pattern checks. They run even when the AI works, as a safety net.
const PATTERNS = [
  { type: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // Swedish personal identity number, with or without century: 19980412-5531
  { type: 'ID', re: /\b(?:19|20)?\d{6}[-+]\d{4}\b/g },
  { type: 'ID', re: /\b(?:19|20)\d{10}\b/g },
  // US social security number and SEVIS ID
  { type: 'ID', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'ID', re: /\bN\d{10}\b/g },
  // Spanish foreigner number (NIE) and national ID (DNI): Y7654321K, 12345678Z
  { type: 'ID', re: /\b[XYZ]\d{7}[A-Z]\b|\b\d{8}[A-HJ-NP-TV-Z]\b/g },
  // Bank account numbers (IBAN): SE45 5000 0000 0583 9825 7466
  { type: 'ID', re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/g },
  // UK National Insurance number: QQ 12 34 56 C
  { type: 'ID', re: /\b[A-CEGHJ-PR-TW-Z]{2} ?\d{2} ?\d{2} ?\d{2} ?[A-D]\b/g },
  // Italian tax code (codice fiscale): RSSMRA85T10A562S
  { type: 'ID', re: /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/g },
  // Finnish personal identity code: 131052-308T
  { type: 'ID', re: /\b\d{6}[-+A]\d{3}[0-9A-Y]\b/g },
  // French social security number: 1 85 05 78 006 084 36
  { type: 'ID', re: /\b[12] ?\d{2} ?\d{2} ?\d{2} ?\d{3} ?\d{3}(?: ?\d{2})?\b/g },
  // Brazilian CPF (123.456.789-09), Indian Aadhaar (1234 5678 9012) and PAN (ABCDE1234F)
  { type: 'ID', re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{4} \d{4} \d{4}\b|\b[A-Z]{5}\d{4}[A-Z]\b/g },
  // Phones: international (+46 ...), Swedish/French (070-123 45 67, 06 12 34 56 78), US ((352) 555-0147)
  { type: 'PHONE', re: /\+\d{1,3}[\s-]?\(?\d{1,4}\)?(?:[\s-]?\d{2,4}){2,4}/g },
  { type: 'PHONE', re: /\b0\d{1,3}[\s-]\d{2,3}(?:[\s-]?\d{2,3}){1,3}\b/g },
  { type: 'PHONE', re: /\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}[-.]\d{3}[-.]\d{4}\b/g },
]

// Numbers that come right after a label like "Case number:" or "Ärendenummer".
const LABELLED_NUMBERS = [
  {
    type: 'CASE',
    re: /(?:ärendenummer|diarienummer|dnr|kundnummer|case number|case no\.?|claim number|claim no\.?|application number|application no\.?|file number|reference number|customer number|account number|referensnummer|numéro de dossier|numéro client|référence|aktenzeichen|geschäftszeichen|kundennummer|número de expediente|expediente|número de cliente|protocollo|numero di pratica|zaaknummer|kenmerk|klantnummer|saksnummer|sagsnummer|journalnummer|asiankohta|diaarinumero|numer sprawy|sygnatura|номер дела|رقم الملف|رقم المرجع)\s*\(?\s*(?:nr|no|n°|nº)?\.?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-/.]{3,30})/gi,
  },
  {
    type: 'ID',
    re: /(?:personnummer|samordningsnummer|personal identity number|national insurance number|ni number|social security number|tax (?:id|identification number|number)|taxpayer id(?: number)?|student id|student number|sevis id|passport number|passport no\.?|residence permit number|reisepass|passnummer|steuer-?id|steuernummer|steueridentifikationsnummer|sozialversicherungsnummer|numéro fiscal|numéro de sécurité sociale|numéro de passeport|numéro étranger|n° allocataire|numéro (?:d')?allocataire|número de pasaporte|número de seguridad social|codice fiscale|numero di passaporto|burgerservicenummer|bsn|fødselsnummer|cpr-nummer|henkilötunnus|pesel|номер паспорта|رقم جواز السفر|رقم الهوية|pasaport numarası|kimlik numarası)\s*\(?\s*(?:nr|no|n°|nº)?\.?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-/ ]{4,30}?)(?=\s*(?:\n|,|;|\)|\.\s|\.$|$))/gi,
  },
]

export function detectWithPatterns(text) {
  const found = []
  for (const { type, re } of PATTERNS) {
    for (const match of text.matchAll(re)) {
      found.push({ text: match[0].trim(), type })
    }
  }
  for (const { type, re } of LABELLED_NUMBERS) {
    for (const match of text.matchAll(re)) {
      found.push({ text: match[1].trim().replace(/[.,;:]+$/, ''), type })
    }
  }
  // Names and addresses by simple rules, so a device without Gemini Nano
  // still finds most of them.
  found.push(...findNamesAndAddresses(text))
  return found
}

// Builds a search pattern that still matches when spaces, line breaks or commas
// differ, for example "Storgatan 14B, 41301 Göteborg" against two lines.
function flexiblePattern(detail) {
  const parts = detail
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (parts.length === 0) return null
  return new RegExp(parts.join('[\\s,]+'), 'gi')
}

export function occurrences(text, detail) {
  const re = flexiblePattern(detail)
  if (!re) return []
  return [...text.matchAll(re)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }))
}

function sameDetailKey(detail) {
  return detail.toLowerCase().replace(/[\s,]+/g, ' ').trim()
}

// Keeps only details that are really in the text, removes duplicates and
// remembers who found each one (AI, pattern check or the user).
export function mergeDetails(text, aiItems, patternItems) {
  const merged = new Map()
  let ignored = 0

  const add = (item, foundBy) => {
    if (occurrences(text, item.text).length === 0) {
      if (foundBy === 'ai') ignored += 1
      return
    }
    const key = sameDetailKey(item.text)
    const existing = merged.get(key)
    if (existing) {
      if (!existing.foundBy.includes(foundBy)) existing.foundBy.push(foundBy)
      return
    }
    merged.set(key, {
      id: crypto.randomUUID(),
      text: item.text,
      type: item.type,
      foundBy: [foundBy],
      hidden: true,
    })
  }

  aiItems.forEach((item) => add(item, 'ai'))
  patternItems.forEach((item) => add(item, 'pattern'))
  return { details: [...merged.values()], ignored }
}

export function makeUserDetail(text) {
  return {
    id: crypto.randomUUID(),
    text,
    type: 'HIDDEN',
    foundBy: ['you'],
    hidden: true,
  }
}

// Splits the notice into plain parts and hidden parts, and builds the text
// that would be shared. The same detail always gets the same label.
export function buildRedaction(text, details) {
  const spans = []
  for (const detail of details) {
    if (!detail.hidden) continue
    for (const span of occurrences(text, detail.text)) {
      spans.push({ ...span, detail })
    }
  }
  // Earlier first; when two overlap, the longer one wins.
  spans.sort((a, b) => a.start - b.start || b.end - a.end)

  const labels = new Map()
  const counters = {}
  const segments = []
  let cursor = 0
  let shared = ''

  for (const span of spans) {
    if (span.start < cursor) {
      // Overlaps the previous hidden part: widen that part so nothing between
      // the two leaks out, for example "Alice Smith" + "Smith Jones".
      const last = segments[segments.length - 1]
      if (last?.detail && span.end > cursor) {
        last.text = text.slice(last.start, span.end)
        cursor = span.end
      }
      continue
    }
    if (span.start > cursor) {
      const plain = text.slice(cursor, span.start)
      segments.push({ text: plain })
      shared += plain
    }
    if (!labels.has(span.detail.id)) {
      const type = span.detail.type
      counters[type] = (counters[type] ?? 0) + 1
      labels.set(span.detail.id, `[${type}_${counters[type]}]`)
    }
    const label = labels.get(span.detail.id)
    segments.push({
      text: text.slice(span.start, span.end),
      start: span.start,
      detail: span.detail,
      label,
    })
    shared += label
    cursor = span.end
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) })
    shared += text.slice(cursor)
  }
  return { segments, shared, labels }
}
