// Reading a photo or a PDF of a letter, on this device only.
// The file is never uploaded. The text it gives is shown to the person to
// check before anything else happens, because reading can make mistakes.
//
// - PDF: pdf.js reads the text inside each page. Pages without text (scans)
//   are drawn as images and read like photos.
// - Photo on a computer with Gemini Nano: Nano reads the image on the device.
// - Photo anywhere else (phones): Tesseract, a text reader that runs in the browser.
// The libraries are only loaded when someone scans, so the app stays fast.
import { t } from './i18n'
import { getGenerativeModel, InferenceMode } from 'firebase/ai'
import { ai, checkOnDeviceModel } from './firebase'
import { withDeadline } from './deadline'

const MAX_SIDE = 2000
const MAX_PDF_PAGES = 15

// Text reader (Tesseract) languages: English, the language of the country you
// live in, and your own language, so a letter can be read on a phone without
// Gemini Nano in more than a few languages. Each one is downloaded once.
const TESSERACT = {
  en: 'eng', sv: 'swe', fr: 'fra', es: 'spa', de: 'deu', it: 'ita', pt: 'por', nl: 'nld', da: 'dan', nb: 'nor',
  fi: 'fin', pl: 'pol', tr: 'tur', ro: 'ron', cs: 'ces', hu: 'hun', hr: 'hrv', sq: 'sqi', el: 'ell', bg: 'bul',
  ru: 'rus', uk: 'ukr', ar: 'ara', fa: 'fas', 'fa-AF': 'fas', ur: 'urd', he: 'heb', hi: 'hin', bn: 'ben',
  zh: 'chi_sim', ja: 'jpn', ko: 'kor', th: 'tha', vi: 'vie', id: 'ind', ms: 'msa', sw: 'swa', am: 'amh', ta: 'tam',
  pa: 'pan', ne: 'nep', uz: 'uzb', ti: 'tir', ps: 'pus', bs: 'bos', sr: 'srp',
}
const COUNTRY_TESSERACT = {
  SE: 'swe', NO: 'nor', DK: 'dan', FI: 'fin+swe', IS: 'isl', DE: 'deu', AT: 'deu', CH: 'deu+fra+ita', FR: 'fra',
  BE: 'fra+nld+deu', LU: 'fra+deu', ES: 'spa+cat', IT: 'ita', PT: 'por', BR: 'por', NL: 'nld', PL: 'pol', CZ: 'ces', SK: 'slk', HU: 'hun',
  RO: 'ron', GR: 'ell', BG: 'bul', HR: 'hrv', SI: 'slv', RS: 'srp', TR: 'tur', UA: 'ukr', RU: 'rus', JP: 'jpn',
  KR: 'kor', CN: 'chi_sim', TW: 'chi_tra', IN: 'hin+tam+ben', IL: 'heb+ara', IR: 'fas', AF: 'fas+pus', PK: 'urd',
  TH: 'tha', VN: 'vie', ID: 'ind', MY: 'msa+chi_sim', ET: 'amh', ER: 'tir+ara', KE: 'swa', TZ: 'swa', CA: 'fra',
  MA: 'ara+fra', DZ: 'ara+fra', TN: 'ara+fra', SG: 'chi_sim+msa',
  SN: 'fra', CI: 'fra', ML: 'fra', CM: 'fra', CD: 'fra', SA: 'ara', AE: 'ara', EG: 'ara', JO: 'ara', LB: 'ara',
  IQ: 'ara', SY: 'ara', KW: 'ara', QA: 'ara', BH: 'ara', OM: 'ara', YE: 'ara', LY: 'ara', SD: 'ara', MX: 'spa',
  AR: 'spa', CO: 'spa', CL: 'spa', PE: 'spa', VE: 'spa', EC: 'spa', BO: 'spa', PY: 'spa', UY: 'spa', CU: 'spa',
  DO: 'spa', GT: 'spa', HN: 'spa', SV: 'spa', NI: 'spa', CR: 'spa', PA: 'spa',
}

export function readerLanguages(languageCode, country) {
  const local = (COUNTRY_TESSERACT[country] ?? '').split('+')
  return [...new Set(['eng', ...local, TESSERACT[languageCode]].filter(Boolean))].slice(0, 5)
}

// Returns { text, method, note, missing }. "note" says honestly what was and
// was not read; "missing" is true when pages were left out.
export async function readFile(file, onProgress = () => {}, languages = ['eng']) {
  if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
    return readPdf(file, onProgress, languages)
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(t('Katty can read photos (JPG, PNG) and PDF files.'))
  }
  const reader = await makeImageReader(onProgress, languages)
  try {
    const text = await reader.read(await toJpeg(file), t('your photo'))
    if (!text.trim()) throw new Error(t('No text was found in the photo. Try a sharper photo in good light.'))
    return { text, method: reader.method, note: '', missing: false }
  } finally {
    await reader.close()
  }
}

async function readPdf(file, onProgress, languages) {
  onProgress(t('Reading the PDF on your device...'))
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const total = pdf.numPages
  const limit = Math.min(total, MAX_PDF_PAGES)
  const pages = []
  let reader = null
  let imagePages = 0

  try {
    for (let n = 1; n <= limit; n += 1) {
      const page = await pdf.getPage(n)
      const content = await page.getTextContent()
      let text = ''
      for (const item of content.items) {
        text += item.str
        text += item.hasEOL ? '\n' : ' '
      }
      text = text.replace(/[ \t]+\n/g, '\n').trim()

      // Little or no text on this page: it is a scan, so read it like a photo.
      // A page with a little text (a typed header) and a picture may be a
      // scanned letter under that header: read it as an image too, and keep
      // whichever gives more text.
      const scanned = text.length < 40
      const maybeScanned = !scanned && text.length < 600 && (await hasImage(page, pdfjs))
      if (scanned || maybeScanned) {
        reader ??= await makeImageReader(onProgress, languages)
        const image = await renderPage(page)
        const read = await reader.read(image, t('page {n} of {total}', { n, total: limit }))
        if (scanned || read.trim().length > text.length) text = read
        imagePages += 1
      }
      pages.push(text)
    }
  } finally {
    await reader?.close()
  }

  const text = pages.filter(Boolean).join('\n\n').trim()
  if (!text) throw new Error(t('No text was found in this PDF.'))

  let note = t('Read {read} of {total} pages.', { read: limit, total })
  if (imagePages > 0) note += ` ${t('{count} of them were read from images.', { count: imagePages })}`
  const missing = total > limit
  if (missing) {
    note += ` ${t('Pages {from} to {to} were not read. If they matter, paste their text below the rest.', { from: limit + 1, to: total })}`
  }
  return { text, method: imagePages === limit ? reader?.method ?? 'pdf' : 'pdf', note, missing, pages: { read: limit, total } }
}

async function renderPage(page) {
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: Math.min(2.5, MAX_SIDE / Math.max(base.width, base.height)) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
}

// Picks the best way to read images on this device, once per file.
// Gemini Nano on a computer that has it, otherwise Tesseract.
async function makeImageReader(onProgress, languages) {
  let tesseract = null
  const nano = (await checkOnDeviceModel()) === 'available'

  async function withTesseract(image) {
    if (!tesseract) {
      onProgress(t('Loading the text reader (first time only)...'))
      const { createWorker } = await import('tesseract.js')
      // The worker is made once per file, so its progress names whatever
      // page or photo is being read at that moment.
      const logger = (m) => {
        if (m.status === 'recognizing text') {
          onProgress(t('Reading {what} on this device: {percent}%', { what: reader.current, percent: Math.round(m.progress * 100) }))
        } else if (m.status?.includes('loading language') && m.progress < 1) {
          onProgress(t('Downloading the text reader: {percent}%', { percent: Math.round(m.progress * 100) }))
        }
      }
      // If one language pack cannot be loaded (offline, for example), read with
      // English alone rather than not at all.
      try {
        tesseract = await createWorker(languages, 1, { logger })
      } catch (err) {
        console.warn('Some text reader languages could not be loaded, using English only.', err)
        try {
          tesseract = await createWorker(['eng'], 1, { logger })
        } catch {
          throw new Error(t('The text reader could not be loaded. Check your internet connection, or paste the text instead.'))
        }
      }
    }
    const { data } = await tesseract.recognize(image)
    return data.text.replace(/\n{3,}/g, '\n\n').trim()
  }

  const reader = {
    method: nano ? 'nano' : 'tesseract',
    current: '',
    async read(image, label) {
      reader.current = label
      if (nano) {
        try {
          onProgress(t('Gemini Nano is reading {what} on this device...', { what: label }))
          // At most a minute, then the text reader (Tesseract) takes over.
          const text = await withDeadline(() => readImageWithNano(image), 60000)
          if (text.trim().length > 20) return text
        } catch (err) {
          console.warn('Gemini Nano could not read the image, using the text reader.', err)
        }
        reader.method = 'tesseract'
      }
      return withTesseract(image)
    },
    async close() {
      await tesseract?.terminate()
    },
  }
  return reader
}

// Turns any image into a JPEG no larger than MAX_SIDE, so it reads faster.
async function toJpeg(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
}

async function blobToBase64(blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < buffer.length; i += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

// Does this PDF page draw a picture (for example a scanned page)?
async function hasImage(page, pdfjs) {
  try {
    const ops = await page.getOperatorList()
    const kinds = [pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintJpegXObject]
    return ops.fnArray.some((fn) => kinds.includes(fn))
  } catch {
    return false
  }
}

async function readImageWithNano(image) {
  const model = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'image' }, { type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
      },
    },
  })
  await model.initializeDeviceModel()
  const result = await model.generateContent([
    'Copy all the text in this photo of a letter exactly as written, in its original language. Keep the line breaks. Do not translate, summarise or add anything. Output only the text.',
    { inlineData: { data: await blobToBase64(image), mimeType: 'image/jpeg' } },
  ])
  return result.response.text().replace(/^```[a-z]*\n?|```$/g, '').trim()
}
