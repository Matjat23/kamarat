// Finding names and addresses without AI, for devices without Gemini Nano.
//
// Rules a person would use when reading a letter:
// - a name after a greeting: "Hej Amina Okafor", "Dear ...", "Sehr geehrte Frau ..."
// - a name after a title: "Mme Sophie Laurent", "Herrn Becker", "Sr. Carlos Ruiz"
// - a name after a role: "handläggare Erik Lindqvist", "your advisor ..."
// - a street with a house number: "Storgatan 14B", "1350 Lakeview Road", "5 allée des Lilas"
// - a postcode with a city: "413 01 Göteborg", "10115 Berlin", "Madison, WI 53703"
// - the line just above a street, when it looks like a name (the address block)
// It will miss some and catch a few extra. The person still checks everything
// before anything is sent.

const GREETINGS = [
  'hej', 'hejsan', 'hallå', 'hi', 'hello', 'dear', 'bonjour', 'cher', 'chère', 'sehr geehrte', 'sehr geehrter',
  'liebe', 'lieber', 'hallo', 'estimado', 'estimada', 'querido', 'querida', 'hola', 'gentile', 'egregio',
  'egregia', 'caro', 'cara', 'beste', 'geachte', 'kære', 'hei', 'hyvä', 'szanowny', 'szanowna', 'sayın', 'prezado',
  'prezada', 'olá',
]

const TITLES = [
  'Frau', 'Herr', 'Herrn', 'Mr', 'Mr.', 'Mrs', 'Mrs.', 'Ms', 'Ms.', 'Miss', 'Dr', 'Dr.', 'M.', 'Mme', 'Mme.',
  'Mlle', 'Sr.', 'Sra.', 'Srta.', 'Sig.', 'Sig.ra', 'Dhr.', 'Mevr.', 'Pan', 'Pani',
]

const ROLES = [
  'handläggare', 'handläggaren', 'kontaktperson', 'advisor', 'adviser', 'counselor', 'counsellor', 'case officer',
  'caseworker', 'contact person', 'conseiller', 'conseillère', 'sachbearbeiter', 'sachbearbeiterin',
  'ansprechpartner', 'ansprechpartnerin', 'gestor', 'gestora', 'referente', 'contactpersoon', 'saksbehandler',
  'sagsbehandler', 'käsittelijä',
]

// Words that follow a greeting but are not names.
const NOT_NAMES = new Set([
  'madame', 'monsieur', 'sir', 'madam', 'customer', 'client', 'student', 'applicant', 'sökande', 'kund',
  'kamarat', 'all', 'team', 'colleague', 'colleagues', 'mesdames', 'messieurs', 'damen', 'herren',
])

// Street words that stand alone, and endings of street names written as one word.
const STREET_WORDS = new Set([
  'road', 'rd', 'rd.', 'street', 'st', 'st.', 'avenue', 'ave', 'ave.', 'boulevard', 'blvd', 'blvd.', 'drive', 'dr.',
  'lane', 'ln', 'ln.', 'way', 'court', 'ct', 'ct.', 'place', 'terrace', 'close', 'crescent', 'rue', 'allée',
  'chemin', 'impasse', 'quai', 'cours', 'calle', 'avenida', 'avda', 'avda.', 'plaza', 'paseo', 'camino', 'carrer',
  'via', 'viale', 'piazza', 'corso', 'vicolo', 'rua', 'travessa', 'largo', 'ulica', 'ul.', 'aleja', 'box',
])
const STREET_ENDINGS = [
  'gatan', 'gata', 'vägen', 'väg', 'gränd', 'torget', 'straße', 'strasse', 'str.', 'weg', 'platz', 'allee', 'gasse',
  'damm', 'ufer', 'gade', 'vej', 'katu', 'straat', 'plein', 'gracht',
]
const FLAT = /^(?:apt|apartment|appartement|app|lgh|lägenhet|wohnung|whg|piso|unit|flat|suite)\.?\s*\d+[A-Za-z]?$/i

const POSTCODE_CITY = [
  /^\d{3}\s?\d{2}\s+\p{Lu}[\p{L}-]+(?:\s\p{Lu}[\p{L}-]+)?$/u, // 413 01 Göteborg
  /^\d{5}\s+\p{Lu}[\p{L}'-]+(?:[\s-]\p{L}[\p{L}'-]+){0,3}$/u, // 10115 Berlin, 31400 Toulouse
  /^\d{4}\s?[A-Z]{2}\s+\p{Lu}[\p{L}-]+$/u, // 1012 AB Amsterdam
  /^\p{Lu}[\p{L} .'-]+,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$/u, // Madison, WI 53703
  /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/, // SW1A 1AA
]
// "1010 Wien" looks like "2026 Annual report", so a 4-digit postcode only
// counts right after a street.
const SHORT_POSTCODE_CITY = /^\d{4}\s+\p{Lu}[\p{L}'-]+(?:[\s-]\p{L}[\p{L}'-]+){0,2}$/u

const isCapitalized = (word) => /^\p{Lu}/u.test(word)
const isNumber = (word) => /^\d+[A-Za-z]?$/.test(word)
const clean = (text) => text.trim().replace(/[.,;:!?]+$/, '').trim()

// Up to four capitalized words from the start of a text: the name.
function nameAt(text) {
  const words = []
  for (const raw of text.split(/\s+/)) {
    const word = raw.replace(/[,:;!?]+$/, '')
    if (!word || !/^\p{Lu}[\p{L}'’.-]*$/u.test(word)) break
    words.push(word)
    if (raw !== word || words.length === 4) break
  }
  const name = clean(words.join(' '))
  if (!name || NOT_NAMES.has(name.toLowerCase())) return ''
  return name.length > 1 ? name : ''
}

function afterWords(text, list, found) {
  const lower = text.toLowerCase()
  for (const word of list) {
    let from = 0
    for (;;) {
      const at = lower.indexOf(word, from)
      if (at === -1) break
      from = at + word.length
      const before = at === 0 ? ' ' : text[at - 1]
      const after = text[from] ?? ''
      if (/\p{L}/u.test(before) || /\p{L}/u.test(after)) continue
      let rest = text.slice(from).replace(/^[\s,:]+(?:is |är |ist |est )?/i, '')
      const title = rest.split(/\s+/)[0]
      if (TITLES.includes(title)) rest = rest.slice(title.length).trimStart()
      const name = nameAt(rest)
      if (name) found.push({ text: name, type: 'NAME' })
    }
  }
}

function titles(text, found) {
  for (const match of text.matchAll(/(?:^|[\s(,])((?:Frau|Herrn?|Mrs?\.?|Ms\.?|Miss|Dr\.?|M\.|Mme\.?|Mlle|Sra?\.|Srta\.|Sig\.(?:ra)?|Dhr\.|Mevr\.|Pani?)\s+)(\p{Lu}[^\n]*)/gu)) {
    const name = nameAt(match[2])
    if (name) found.push({ text: name, type: 'NAME' })
  }
}

// The street part of a piece of text, for example "Hauptstraße 5" in
// "wohnhaft Hauptstraße 5".
function streetIn(segment) {
  const words = segment.trim().split(/\s+/)
  const index = words.findIndex((w) => {
    const lower = w.toLowerCase().replace(/[,]$/, '')
    if (STREET_WORDS.has(lower)) return true
    return isCapitalized(w) && STREET_ENDINGS.some((end) => lower.endsWith(end) && lower.length > end.length + 1)
  })
  if (index === -1) return ''
  let start = index
  while (start > 0 && index - start < 3 && (isCapitalized(words[start - 1]) || isNumber(words[start - 1]))) start -= 1
  let end = index
  const particles = new Set(['de', 'des', 'du', 'la', 'le', 'del', 'di', 'da', 'do', 'dos', 'das', 'van', 'von'])
  while (end + 1 < words.length && end - index < 4) {
    const next = words[end + 1].replace(/[,.]$/, '')
    if (isNumber(next) || isCapitalized(next) || particles.has(next) || /^(lgh|apt|nr|no)\.?$/i.test(next)) end += 1
    else break
  }
  const street = clean(words.slice(start, end + 1).join(' '))
  return /\d/.test(street) ? street : ''
}

export function findNamesAndAddresses(text) {
  const found = []
  afterWords(text, GREETINGS, found)
  afterWords(text, ROLES, found)
  titles(text, found)

  const lines = text.split('\n')
  let streetAbove = false
  lines.forEach((line, i) => {
    let streetHere = false
    const isPostcode = (part) =>
      POSTCODE_CITY.some((re) => re.test(part)) || ((streetAbove || streetHere) && SHORT_POSTCODE_CITY.test(part))
    // A whole line like "Madison, WI 53703" would be split at the comma below.
    const whole = clean(line)
    if (isPostcode(whole)) {
      found.push({ text: whole, type: 'ADDRESS' })
      streetAbove = false
      return
    }
    for (const segment of line.split(/[,;]/)) {
      const part = clean(segment)
      if (!part) continue
      const street = streetIn(part)
      if (street) {
        found.push({ text: street, type: 'ADDRESS' })
        streetHere = true
      } else if (FLAT.test(part) || isPostcode(part)) {
        found.push({ text: part, type: 'ADDRESS' })
      }
    }
    if (whole) streetAbove = streetHere
    // The address block: the line above the street is often the person's name.
    if (streetHere && i > 0) {
      const above = clean(lines[i - 1])
      const name = nameAt(above.replace(/^(?:M\.|Mme|Mr\.?|Mrs\.?|Ms\.?|Frau|Herr)\s+/, ''))
      if (name && name === above.replace(/^(?:M\.|Mme|Mr\.?|Mrs\.?|Ms\.?|Frau|Herr)\s+/, '') && name.split(' ').length >= 2) {
        found.push({ text: name, type: 'NAME' })
      }
    }
  })
  return found
}
