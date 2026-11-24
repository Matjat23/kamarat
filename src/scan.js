// Reading a photo or a PDF of a letter, on this device only.
// The file is never uploaded. The text it gives is shown to the person to
// check before anything else happens, because reading can make mistakes.
//
// - PDF: pdf.js reads the text inside the file (exact, no guessing).
// - Photo on a computer with Gemini Nano: Nano reads the image on the device.
// - Photo anywhere else (phones): Tesseract, a text reader that runs in the browser.
// The libraries are only loaded when someone scans, so the app stays fast.
import { getGenerativeModel, InferenceMode } from 'firebase/ai'
import { ai, checkOnDeviceModel } from './firebase'

const MAX_SIDE = 2000

export async function readFile(file, onProgress = () => {}) {
  if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
    onProgress('Reading the PDF on your device...')
    const pdf = await readPdf(file)
    if (pdf.text) return { text: pdf.text, method: 'pdf' }
    // A scanned PDF has no text inside: read its first page like a photo.
    onProgress('This PDF is a scan. Reading the page like a photo...')
    return readImage(pdf.firstPageImage, onProgress)
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Kamarat can read photos (JPG, PNG) and PDF files.')
  }
  return readImage(await toJpeg(file), onProgress)
}

async function readImage(image, onProgress) {
  if ((await checkOnDeviceModel()) === 'available') {
    try {
      onProgress('Gemini Nano is reading your photo on this device...')
      const text = await readImageWithNano(image)
      if (text.trim().length > 20) return { text, method: 'nano' }
    } catch (err) {
      console.warn('Gemini Nano could not read the photo, trying the text reader.', err)
    }
  }

  return { text: await readImageWithTesseract(image, onProgress), method: 'tesseract' }
}

async function readPdf(file) {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages = []
  for (let n = 1; n <= Math.min(pdf.numPages, 6); n += 1) {
    const page = await pdf.getPage(n)
    const content = await page.getTextContent()
    let text = ''
    for (const item of content.items) {
      text += item.str
      text += item.hasEOL ? '\n' : ' '
    }
    pages.push(text.replace(/[ \t]+\n/g, '\n').trim())
  }
  const text = pages.join('\n\n').trim()
  if (text) return { text }

  // No text: draw the first page into an image so it can be read like a photo.
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: Math.min(2.5, MAX_SIDE / Math.max(base.width, base.height)) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise
  const firstPageImage = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  return { text: '', firstPageImage }
}

// Turns any image into a JPEG no larger than MAX_SIDE, so it reads faster.
async function toJpeg(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  return blob
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

async function readImageWithTesseract(image, onProgress) {
  onProgress('Loading the text reader (first time only)...')
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['swe', 'eng', 'fra'], 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress(`Reading your photo on this device: ${Math.round(m.progress * 100)}%`)
      }
    },
  })
  try {
    const { data } = await worker.recognize(image)
    return data.text.replace(/\n{3,}/g, '\n\n').trim()
  } finally {
    await worker.terminate()
  }
}
