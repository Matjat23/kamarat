// Finding names and addresses without AI, for devices without Gemini Nano.
//
// Rules a person would use when reading a letter:
// - a name after a greeting: "Hej Amina Okafor", "Dear Jan van der Meer"
// - a name after a title or role: "Mme Sophie Laurent", "handläggare Erik Lindqvist"
// - a name after "c/o", "z. Hd." or "à l'attention de"
// - a name before 様 or 殿 (Japanese), or after السيد / السيدة (Arabic)
// - a home address: an address block (a street line followed by a postcode and
//   city), or a street the letter calls your address ("wohnhaft ...", "vous
//   habitez au ...", "bor på ...")
// - the name line just above an address block
// A street that is not your address, like a court or an office you must go
// to, is left alone, because the explanation needs it. The rules will miss
// some details and the person still checks everything before it is sent.

const GREETINGS = [
  'hej', 'hejsan', 'hallå', 'hi', 'hello', 'dear', 'bonjour', 'cher', 'chère', 'sehr geehrte', 'sehr geehrter',
  'liebe', 'lieber', 'hallo', 'estimado', 'estimada', 'querido', 'querida', 'hola', 'gentile', 'egregio',
  'egregia', 'caro', 'cara', 'beste', 'geachte', 'kære', 'hei', 'hyvä', 'szanowny', 'szanowna', 'sayın', 'prezado',
  'prezada', 'olá',
]

const ROLES = [
  'handläggare', 'handläggaren', 'kontaktperson', 'advisor', 'adviser', 'counselor', 'counsellor', 'case officer',
  'caseworker', 'contact person', 'conseiller', 'conseillère', 'sachbearbeiter', 'sachbearbeiterin',
  'ansprechpartner', 'ansprechpartnerin', 'gestor', 'gestora', 'referente', 'contactpersoon', 'saksbehandler',
  'sagsbehandler', 'käsittelijä', 'c/o', 'z. hd.', 'z.hd.', "à l'attention de", 'attn:', 'attn.', 'att:',
]

const TITLE = String.raw`(?:Frau|Herrn?|Mrs?\.?|Ms\.?|Miss|Dr\.?|M\.|Mme\.?|Mlle|Sra?\.|Srta\.|Sig\.(?:ra)?|Dhr\.|Mevr\.|Pani?|Dña\.|Doña|Don|D\.|heer|mevrouw)`

// Words that follow a greeting but are not names.
const NOT_NAMES = new Set([
  'madame', 'monsieur', 'sir', 'madam', 'customer', 'client', 'student', 'applicant', 'sökande', 'kund',
  'katty', 'all', 'team', 'colleague', 'colleagues', 'mesdames', 'messieurs', 'damen', 'herren',
])

// Small words inside names: Jan van der Meer, Ana de la Cruz, Omar bin Said.
const PARTICLES = new Set([
  'van', 'der', 'den', 'de', 'du', 'des', 'da', 'do', 'dos', 'das', 'di', 'del', 'della', 'la', 'le', 'von', 'zu',
  'bin', 'binti', 'ibn', 'al', 'el', 'ben', 'ter', 'ten', 'af', 'av',
])

// Street words that stand alone, and endings of street names written as one word.
const STREET_WORDS = new Set([
  'road', 'rd', 'rd.', 'street', 'st', 'st.', 'avenue', 'ave', 'ave.', 'boulevard', 'blvd', 'blvd.', 'drive', 'dr.',
  'lane', 'ln', 'ln.', 'way', 'court', 'ct', 'ct.', 'place', 'terrace', 'close', 'crescent', 'rue', 'allée',
  'chemin', 'impasse', 'quai', 'cours', 'calle', 'avenida', 'avda', 'avda.', 'plaza', 'paseo', 'camino', 'carrer',
  'via', 'viale', 'piazza', 'corso', 'vicolo', 'rua', 'travessa', 'largo', 'ulica', 'ul.', 'aleja', 'box', 'c/',
])
const STREET_ENDINGS = [
  'gatan', 'gata', 'vägen', 'väg', 'gränd', 'torget', 'straße', 'strasse', 'str.', 'weg', 'platz', 'allee', 'gasse',
  'damm', 'ufer', 'gade', 'vej', 'katu', 'straat', 'plein', 'gracht',
]
const FLAT = /^(?:(?:apt|apartment|appartement|app|lgh|lägenhet|wohnung|whg|piso|unit|flat|suite)\.?\s*\d+[A-Za-z]?|\d+\s?[º°ª]\s?[A-Za-z]?)$/i

// Words that say a street is the person's own address.
const HOME_CUES = [
  'habitez', 'habite', 'domicilié', 'domiciliée', 'demeurant', 'résidant', 'votre adresse', 'wohnhaft', 'wohnen',
  'ihre adresse', 'ihre anschrift', 'your address', 'residing', 'resident at', 'living at', 'you live at',
  'adressen', 'din adress', 'bor på', 'bosatt', 'folkbokförd', 'su domicilio', 'domiciliado', 'domiciliada',
  'reside en', 'vive en', 'residente in', 'il suo indirizzo', 'woonachtig', 'uw adres',
]

const POSTCODE_CITY = [
  /^\d{3}\s?\d{2}\s+\p{Lu}[\p{L}-]+(?:\s\p{Lu}[\p{L}-]+)?$/u, // 413 01 Göteborg
  /^\d{5}\s+\p{Lu}[\p{L}'-]+(?:[\s-]\p{L}[\p{L}'-]+){0,3}$/u, // 10115 Berlin, 31400 Toulouse
  /^\d{4}\s?[A-Z]{2}\s+\p{Lu}[\p{L}-]+$/u, // 1012 AB Amsterdam
  /^\p{Lu}[\p{L} .'-]+,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$/u, // Madison, WI 53703
  /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/, // SW1A 1AA
  /^\p{Lu}[\p{L} .'-]+\s+[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/u, // Manchester M14 6RT
  /^\p{Lu}[\p{L} .'-]+,?\s+[A-Z]{2}\s+[A-Z]\d[A-Z]\s?\d[A-Z]\d$/u, // Toronto ON M5V 2T6
  /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/, // M5V 2T6
]
// "1010 Wien" looks like "1350 Lakeview Road" or "2026 Annual report", so a
// 4-digit postcode only counts next to a street, and never on a street itself.
const SHORT_POSTCODE_CITY = /^\d{4}\s+\p{Lu}[\p{L}'-]+(?:[\s-]\p{L}[\p{L}'-]+){0,2}$/u

// Japanese addresses: 東京都新宿区新宿3丁目12番5号
const JAPANESE_ADDRESS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,14}[0-9０-９一二三四五六七八九十]+丁目[0-9０-９]+番地?(?:[0-9０-９]+号?)?/gu
const JAPANESE_NAME = /([\p{Script=Han}\p{Script=Katakana}]{1,5}(?:[ 　][\p{Script=Han}\p{Script=Katakana}]{1,5})?)\s?(?:様|殿)/gu
const ARABIC_NAME = /(?:السيد|السيدة|الأستاذ|الأستاذة|السادة)\s+((?:\p{Script=Arabic}+\s?){1,3})/gu

const isCapitalized = (word) => /^\p{Lu}/u.test(word)
// House numbers: 14, 14B, 120-2, 12/3
const isNumber = (word) => /^\d+(?:[A-Za-z]|[-/]\d+[A-Za-z]?)?$/.test(word)
const clean = (text) => text.trim().replace(/[.,;:!?]+$/, '').trim()

// The name at the start of a text: capitalized words, with small particles
// between them ("Jan van der Meer"), up to five words.
function nameAt(text) {
  const raw = text.split(/\s+/)
  const words = []
  for (let i = 0; i < raw.length && words.length < 5; i++) {
    const word = raw[i].replace(/[,:;!?]+$/, '')
    const ended = raw[i] !== word
    const capital = /^\p{Lu}[\p{L}'’.-]*$/u.test(word) || /^(?:al|el|d)['’-]\p{Lu}/u.test(word)
    // A particle only counts when a capitalized word follows it, perhaps after
    // more particles: "van der Meer".
    let ahead = i + 1
    while (ahead < raw.length && PARTICLES.has(raw[ahead])) ahead += 1
    const particle = PARTICLES.has(word) && words.length > 0 && ahead < raw.length && isCapitalized(raw[ahead])
    if (!capital && !particle) break
    words.push(word)
    if (ended) break
  }
  while (words.length && PARTICLES.has(words[words.length - 1])) words.pop()
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
      if (/\p{L}/u.test(before) || (/\p{L}$/u.test(word) && /\p{L}/u.test(after))) continue
      let rest = text.slice(from).replace(/^[\s,:]+(?:is |är |ist |est )?/i, '')
      const title = new RegExp(`^${TITLE}\\s+`, 'u').exec(rest)
      if (title) rest = rest.slice(title[0].length)
      const name = nameAt(rest)
      if (name) found.push({ text: name, type: 'NAME' })
    }
  }
}

function titles(text, found) {
  const re = new RegExp(`(?:^|[\\s(,])${TITLE}\\s+(\\p{Lu}[^\\n]*)`, 'gu')
  for (const match of text.matchAll(re)) {
    const name = nameAt(match[1])
    if (name) found.push({ text: name, type: 'NAME' })
  }
}

function isStreetWord(word) {
  const lower = word.toLowerCase().replace(/[,]$/, '')
  if (STREET_WORDS.has(lower)) return true
  return isCapitalized(word) && STREET_ENDINGS.some((end) => lower.endsWith(end) && lower.length > end.length + 1)
}

// Every street with a house number in a piece of text, for example
// "12 bis rue Victor Hugo" and "8 rue Pasteur".
function streetsIn(segment) {
  const words = segment.trim().split(/\s+/)
  const streets = []
  let after = -1
  words.forEach((word, index) => {
    if (index <= after || !isStreetWord(word)) return
    let start = index
    const houseExtra = /^(?:bis|ter|quater|[a-z])$/i
    while (start > after + 1 && index - start < 4) {
      const prev = words[start - 1].replace(/,$/, '')
      if (isCapitalized(prev) || isNumber(prev) || (houseExtra.test(prev) && start - 2 >= 0 && isNumber(words[start - 2]))) start -= 1
      else break
    }
    let end = index
    while (end + 1 < words.length && end - index < 4) {
      const next = words[end + 1].replace(/[,.]$/, '')
      if (isStreetWord(words[end + 1])) break
      if (isNumber(next) || isCapitalized(next) || PARTICLES.has(next) || /^(lgh|apt|nr|no|bis|ter)\.?$/i.test(next)) end += 1
      else break
    }
    const street = clean(words.slice(start, end + 1).join(' '))
    if (/\d/.test(street)) {
      streets.push(street)
      after = end
    }
  })
  return streets
}

// Words that mark an institution's address (a court, an office, an agency).
// Those addresses stay visible: the person may need to go there.
const INSTITUTION = /(?:^|[^\p{L}])(?:centre|center|court|tribunal|office|kontor|servicekontor|ufficio|questura|bureau|oficina|büro|amt|behörde|landesamt|rathaus|préfecture|prefecture|ministry|ministère|ministerium|ministerio|agency|myndighet|verket|kassan|kommun|council|hospital|klinik|university|universität|université|universidad|universitet|embassy|consulate|ambassade|konsulat|delegación|department|police|polis|polizei|gendarmerie)(?:[^\p{L}]|$)/iu
const isInstitution = (line) => INSTITUTION.test(line)

const isPostcode = (part, nextToStreet = false) =>
  POSTCODE_CITY.some((re) => re.test(part)) || (nextToStreet && streetsIn(part).length === 0 && SHORT_POSTCODE_CITY.test(part))
const CARE_OF = /^(?:c\/o|co|z\.\s?hd\.|à l'attention de|attn[:.]?|att:)\s/i
const hasHomeCue = (line) => HOME_CUES.some((cue) => line.toLowerCase().includes(cue))

export function findNamesAndAddresses(text) {
  const found = []
  afterWords(text, GREETINGS, found)
  afterWords(text, ROLES, found)
  titles(text, found)
  for (const match of text.matchAll(JAPANESE_NAME)) found.push({ text: match[1].trim(), type: 'NAME' })
  for (const match of text.matchAll(ARABIC_NAME)) found.push({ text: match[1].trim(), type: 'NAME' })
  for (const match of text.matchAll(JAPANESE_ADDRESS)) found.push({ text: match[0], type: 'ADDRESS' })

  const lines = text.split('\n').map(clean)
  const nextFilled = (i) => lines.slice(i + 1).find((l) => l) ?? ''

  lines.forEach((line, i) => {
    if (!line) return
    const segments = line.split(/[,;]/).map(clean).filter(Boolean)
    const streets = segments.flatMap(streetsIn)
    if (streets.length === 0) return
    // A home address: an address block (the postcode and city follow on this
    // line or the next), or a sentence that says it is your address.
    const postcodeHere = segments.some((p) => streetsIn(p).length === 0 && isPostcode(p, true))
    const below = nextFilled(i)
    const block =
      postcodeHere || isPostcode(below, true) || below.split(/[,;]/).map(clean).some((p) => FLAT.test(p) || isPostcode(p, true))
    if (!block && !hasHomeCue(line)) return
    // An institution's address, on this line or the one above, is not yours.
    // The street's own name does not count ("University Blvd" is a street).
    const besideStreets = streets.reduce((rest, street) => rest.replace(street, ' '), line)
    if (!hasHomeCue(line) && (isInstitution(besideStreets) || (i > 0 && isInstitution(lines[i - 1])))) return

    streets.forEach((street) => found.push({ text: street, type: 'ADDRESS' }))
    segments
      .filter((p) => streetsIn(p).length === 0 && (FLAT.test(p) || isPostcode(p, true)))
      .forEach((p) => found.push({ text: p, type: 'ADDRESS' }))
    if (!postcodeHere) {
      // The postcode and city, and a flat number, on the next line.
      for (const part of below.split(/[,;]/).map(clean)) {
        if (FLAT.test(part) || isPostcode(part, true)) found.push({ text: part, type: 'ADDRESS' })
      }
      if (isPostcode(below, true)) found.push({ text: below, type: 'ADDRESS' })
    }
    // In an address block, the line above the street is often the name. A
    // "c/o" line in between is skipped (its name is found by the c/o rule).
    if (block) {
      for (let up = i - 1; up >= 0 && up >= i - 3; up--) {
        if (!lines[up]) break
        if (CARE_OF.test(lines[up])) continue
        const above = lines[up].replace(new RegExp(`^${TITLE}\\s+`, 'u'), '')
        const name = nameAt(above)
        if (name && name === above && name.split(' ').length >= 2) found.push({ text: name, type: 'NAME' })
        break
      }
    }
  })
  return found
}

// True when most letters in the text have no capitals (Arabic, Chinese,
// Japanese, Amharic...). The name rules above rely on capitals, so the person
// is told to look for names themselves.
export function mostlyWithoutCapitals(text) {
  const cased = (text.match(/[\p{Lu}\p{Ll}]/gu) ?? []).length
  const other = (text.match(/\p{Lo}/gu) ?? []).length
  return other > 20 && other > cased
}
