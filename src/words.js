// Word help: tap a word in the approved notice and get it explained.
// The word and its sentence come from the approved text, so they contain no
// hidden personal details. Answers are kept for the session so the same word is
// never asked twice.
import { getWordModel } from './firebase'
import { LANGUAGES } from './explain'

const cache = new Map()

export function sentenceAround(text, index) {
  const before = text.lastIndexOf('.', index - 1)
  const breakBefore = text.lastIndexOf('\n', index - 1)
  const start = Math.max(before, breakBefore) + 1
  const afterDot = text.indexOf('.', index)
  const afterBreak = text.indexOf('\n', index)
  const ends = [afterDot === -1 ? text.length : afterDot + 1, afterBreak === -1 ? text.length : afterBreak]
  return text.slice(start, Math.min(...ends)).trim()
}

export async function explainWord(word, sentence, language) {
  const key = `${language}|${word.toLowerCase()}|${sentence}`
  if (cache.has(key)) return cache.get(key)

  const code = LANGUAGES.find((l) => l.name === language)?.code ?? 'en'
  const model = getWordModel(code)
  const prompt = `A newcomer is reading an official letter and does not know a word.

Word: "${word}"
Sentence from the letter: "${sentence}"

In ${language}, explain in one or two short, simple sentences what "${word}" means here. If it is a name of an agency or a document, say what it is. Do not add advice. Answer with the explanation only.`

  try {
    await model.initializeDeviceModel?.()
  } catch {
    // No on-device model here: PREFER_ON_DEVICE falls back to the cloud by itself.
  }
  const result = await model.generateContent(prompt)
  const answer = {
    text: result.response.text().trim(),
    source: result.response.inferenceSource,
  }
  cache.set(key, answer)
  return answer
}
