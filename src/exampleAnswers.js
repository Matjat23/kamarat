// Explanations written by hand for the two example letters, in the same shape
// Gemini answers in. They are only used when both cloud Gemini and Gemini Nano
// fail, so someone trying an example on a busy day still sees how Katty works,
// and the screen says that it is a prepared example. Every quote is a sentence
// of the example letter, so the usual quote and date checks still apply.

const SWEDISH_MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']
const ENGLISH_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const iso = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

// "22 december 2026" -> "2026-12-22"
function swedishDate(text) {
  const match = text.match(/(\d{1,2}) ([a-zå]+) (\d{4})/)
  const month = match ? SWEDISH_MONTHS.indexOf(match[2]) + 1 : 0
  return month ? iso(match[3], month, match[1]) : ''
}

// "January 6, 2027" -> "2027-01-06"
function englishDate(text) {
  const match = text.match(/([A-Z][a-z]+) (\d{1,2}), (\d{4})/)
  const month = match ? ENGLISH_MONTHS.indexOf(match[1]) + 1 : 0
  return month ? iso(match[3], month, match[2]) : ''
}

// The sentence of the letter that starts with `start`, or '' if it is not there.
function sentence(text, start) {
  const from = text.indexOf(start)
  if (from === -1) return ''
  const end = text.indexOf('.', from + start.length)
  return text.slice(from, end === -1 ? undefined : end + 1)
}

function swedishMigration(text) {
  const fee = sentence(text, 'Avgiften på 1 500 kr ska betalas senast den')
  return {
    sender: 'Migrationsverket',
    summary:
      'Migrationsverket is handling your application to extend your residence permit for studies. They need a copy of your admission decision and a certificate of your study results, and the application fee has to be paid.',
    noticeDate: (text.match(/Göteborg (\d{4}-\d{2}-\d{2})/) ?? [])[1] ?? '',
    worry: {
      level: 'URGENT',
      reason: 'There is a deadline, and if the documents do not arrive, your application can be decided without them and refused.',
      quote: sentence(text, 'Om vi inte får kompletteringen'),
    },
    actions: [
      {
        kind: 'MUST',
        title: 'Send the missing documents',
        explanation: 'Send a copy of your admission decision and a certificate of your study results from your university.',
        quote: sentence(text, 'Skicka in kompletteringen inom 14 dagar'),
        deadline: { kind: 'AFTER_RECEIVING', amount: 14, unit: 'DAYS' },
      },
      {
        kind: 'MUST',
        title: 'Pay the application fee',
        explanation: 'Pay the fee of 1,500 kronor for your application.',
        quote: fee,
        deadline: { kind: 'FIXED_DATE', date: swedishDate(fee) },
      },
      {
        kind: 'CAN',
        title: 'Send the documents online',
        explanation: 'You can send the documents through the e-service on migrationsverket.se. Always write your case number.',
        quote: sentence(text, 'Du kan skicka kompletteringen via e-tjänsten'),
        deadline: { kind: 'NONE' },
      },
    ],
    sources: [
      { id: 'mv-send-documents', why: 'How to send documents to Migrationsverket.' },
      { id: 'mv-application-fee-study-extension', why: 'How to pay the fee for a study extension.' },
      { id: 'mv-eservices-login', why: 'How to log in to the e-services.' },
    ],
    officialSites: [],
  }
}

function usUniversity(text) {
  const endDate = sentence(text, 'Our records show that your I-20 program end date is')
  return {
    sender: 'Example State University, International Student and Scholar Services',
    summary:
      'Your I-20 program end date is coming up. If you want to keep studying or apply for OPT, you have to send a request to the international office before that date. You also have to upload new financial documents.',
    noticeDate: englishDate(text.split('\n').find((line) => /^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(line.trim())) ?? ''),
    worry: {
      level: 'ACTION',
      reason: 'These are routine steps, but they have dates, and a late or incomplete request can delay your new I-20.',
      quote: sentence(text, 'Incomplete requests may delay your new I-20'),
    },
    actions: [
      {
        kind: 'MUST',
        title: 'Upload your financial documents',
        explanation: 'Upload your updated financial documents to the student portal.',
        quote: sentence(text, 'Please upload your updated financial documents'),
        deadline: { kind: 'AFTER_NOTICE_DATE', amount: 10, unit: 'BUSINESS_DAYS' },
      },
      {
        kind: 'MUST',
        title: 'Ask to continue your studies or for OPT',
        explanation: 'If you want to keep studying or work on OPT, send your request to the international office before your program end date.',
        quote: endDate,
        deadline: { kind: 'FIXED_DATE', date: englishDate(endDate) },
      },
      {
        kind: 'CAN',
        title: 'Apply for OPT if you want to work',
        explanation: 'USCIS must receive your OPT application within 60 days after your program end date. You cannot start working before you have your work permit card.',
        quote: sentence(text, 'If you apply for OPT'),
        deadline: { kind: 'AFTER_OTHER_EVENT', amount: 60, unit: 'DAYS', event: 'your program end date' },
      },
    ],
    sources: [
      { id: 'sits-form-i-20', why: 'What the I-20 is and how to keep it valid.' },
      { id: 'uscis-opt-f1', why: 'How to apply for OPT with USCIS.' },
      { id: 'sits-applying-practical-training', why: 'Steps for applying for practical training.' },
    ],
    officialSites: [],
  }
}

// The sentences of each example that never change (its dates do). A letter
// only counts as the example when it has all of them and little else, so a
// real letter from the same sender never gets a prepared answer.
const SWEDISH_SENTENCES = [
  'Begäran om komplettering',
  'Vi har tagit emot din ansökan om förlängning av uppehållstillstånd för studier.',
  'För att kunna fortsätta handlägga ärendet behöver vi en kopia av ditt antagningsbesked och ett intyg om studieresultat från ditt universitet.',
  'Skicka in kompletteringen inom 14 dagar från att du har tagit emot detta brev.',
  'Om vi inte får kompletteringen kan din ansökan komma att avgöras på befintligt underlag, vilket kan leda till att den avslås.',
  'Avgiften på 1 500 kr ska betalas senast den',
  'Du kan skicka kompletteringen via e-tjänsten på migrationsverket.se. Ange alltid ditt ärendenummer.',
]
const US_SENTENCES = [
  'Example State University',
  'Subject: Action required before your program end date',
  'Our records show that your I-20 program end date is',
  'If you plan to continue your studies or apply for Optional Practical Training (OPT), you must submit a request to our office before this date.',
  'If you apply for OPT, your application must be received by U.S. Citizenship and Immigration Services no later than 60 days after your program end date.',
  'Please upload your updated financial documents to the student portal within 10 business days of this notice.',
]
// With the hidden details as labels, both examples are under 1,000 characters.
const MAX_LENGTH = 1500

const isExample = (text, sentences) => text.length <= MAX_LENGTH && sentences.every((s) => text.includes(s))

// The prepared answer for an example letter, or null for any other text.
export function exampleAnswer(sharedText) {
  if (isExample(sharedText, SWEDISH_SENTENCES)) return swedishMigration(sharedText)
  if (isExample(sharedText, US_SENTENCES)) return usUniversity(sharedText)
  return null
}
