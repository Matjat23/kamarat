// Reading a photo or a PDF of a letter, on this device only.
// The file is never uploaded. The text it gives is shown to the person to
// check before anything else happens, because reading can make mistakes.
//
// - PDF: pdf.js reads the text inside each page. Pages without text (scans)
//   are drawn as images and read like photos.
// - Photo on a computer with Gemini Nano: Nano reads the image on the device.
// - Photo anywhere else (phones): Tesseract, a text reader that runs in the browser.
// The libraries are only loaded when someone scans, so the app stays fast.
import { getGenerativeModel, InferenceMode } from 'firebase/ai'
import { ai, checkOnDeviceModel } from './firebase'

const MAX_SIDE = 2000
const MAX_PDF_PAGES = 15

// Returns { text, method, note }. "note" says honestly what was and was not read.
export async function readFile(file, onProgress = () => {}) {
  if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
    return readPdf(file, onProgress)
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Kamarat can read photos (JPG, PNG) and PDF files.')
  }
  const reader = await makeImageReader(onProgress)
  try {
    const text = await reader.read(await toJpeg(file), 'your photo')
    if (!text.trim()) throw new Error('No text was found in the photo. Try a sharper photo in good light.')
    return { text, method: reader.method, note: '' }
  } finally {
    await reader.close()
  }
}

async function readPdf(file, onProgress) {
  onProgress('Reading the PDF on your device...')
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
      if (text.length < 40) {
        reader ??= await makeImageReader(onProgress)
        const image = await renderPage(page)
        text = await reader.read(image, `page ${n} of ${limit}`)
        imagePages += 1
      }
      pages.push(text)
    }
  } finally {
    await reader?.close()
  }

  const text = pages.filter(Boolean).join('\n\n').trim()
  if (!text) throw new Error('No text was found in this PDF.')

  const parts = [`Read ${limit} of ${total} page${total === 1 ? '' : 's'}`]
  if (imagePages > 0) parts.push(`${imagePages} of them from images`)
  let note = `${parts.join(', ')}.`
  if (total > limit) {
    note += ` Pages ${limit + 1} to ${total} were not read. If they matter, paste their text below the rest.`
  }
  return { text, method: imagePages === limit ? reader?.method ?? 'pdf' : 'pdf', note }
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
async function makeImageReader(onProgress) {
  let tesseract = null
  const nano = (await checkOnDeviceModel()) === 'available'

  async function withTesseract(image, label) {
    if (!tesseract) {
      onProgress('Loading the text reader (first time only)...')
      const { createWorker } = await import('tesseract.js')
      tesseract = await createWorker(['swe', 'eng', 'fra'], 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress(`Reading ${reader.current} on this device: ${Math.round(m.progress * 100)}%`)
          }
        },
      })
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
          onProgress(`Gemini Nano is reading ${label} on this device...`)
          const text = await readImageWithNano(image)
          if (text.trim().length > 20) return text
        } catch (err) {
          console.warn('Gemini Nano could not read the image, using the text reader.', err)
        }
        reader.method = 'tesseract'
      }
      return withTesseract(image, label)
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
