// Word help: pick a word in the approved notice and get it explained.
// What is sent: the word, and unless the person turns it off, the sentence it
// is in. Both come from the approved text, where hidden details are already
// labels. It goes to Gemini Nano on the device when it can write the chosen
// language and is ready; otherwise it goes to cloud Gemini.
// Answers are kept for the session, and a word that is already being looked
// up is not asked twice.
import { getWordModel, EXPLAIN_MODELS } from './firebase'
import { LANGUAGES } from './explain'
import { QuotaError, isDailyLimit, markUsedUp, usableModels } from './quota'

const cache = new Map()
const pending = new Map()

export function sentenceAround(text, index) {
  const before = text.lastIndexOf('.', index - 1)
  const breakBefore = text.lastIndexOf('\n', index - 1)
  const start = Math.max(before, breakBefore) + 1
  const afterDot = text.indexOf('.', index)
  const afterBreak = text.indexOf('\n', index)
  const ends = [afterDot === -1 ? text.length : afterDot + 1, afterBreak === -1 ? text.length : afterBreak]
  return text.slice(start, Math.min(...ends)).trim()
}

// Where a typed word first appears in the text, as a whole word, or -1.
export function findWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(^|[^\\p{L}])(${escaped})(?![\\p{L}])`, 'iu').exec(text)
  return match ? match.index + match[1].length : -1
}

function buildPrompt(word, sentence, language) {
  const context = sentence ? `\nSentence from the letter: "${sentence}"` : ''
  return `A newcomer is reading an official letter and does not know a word.

Word: "${word}"${context}

In ${language}, explain in one or two short, simple sentences what "${word}" means${sentence ? ' here' : ' in an official letter'}. If it is a name of an agency or a document, say what it is. Do not add advice. Answer with the explanation only.`
}

async function lookUp(word, sentence, language) {
  const code = LANGUAGES.find((l) => l.name === language)?.code ?? 'en'
  const modelName = usableModels(EXPLAIN_MODELS)[0] ?? EXPLAIN_MODELS[0]
  const model = getWordModel(code, modelName)
  try {
    await model.initializeDeviceModel?.()
  } catch {
    // No on-device model here: PREFER_ON_DEVICE falls back to the cloud by itself.
  }
  try {
    const result = await model.generateContent(buildPrompt(word, sentence, language))
    return { text: result.response.text().trim(), source: result.response.inferenceSource }
  } catch (err) {
    if (isDailyLimit(err)) {
      markUsedUp(modelName)
      throw new QuotaError()
    }
    throw err
  }
}

// sentence may be empty: then only the word is sent.
export function explainWord(word, sentence, language) {
  const key = `${language}|${word.toLowerCase()}|${sentence ?? ''}`
  if (cache.has(key)) return Promise.resolve(cache.get(key))
  if (pending.has(key)) return pending.get(key)
  const request = lookUp(word, sentence, language)
    .then((answer) => {
      cache.set(key, answer)
      return answer
    })
    .finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}
