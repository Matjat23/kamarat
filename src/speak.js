// Reading the explanation aloud with the voices built into the device.
// Nothing is sent anywhere; the browser speaks the text itself.

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function voicesNow() {
  return new Promise((resolve) => {
    const list = window.speechSynthesis.getVoices()
    if (list.length) return resolve(list)
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices())
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000)
  })
}

// Finds a voice for the language, for example "sv" matches "sv-SE".
export async function voiceFor(code) {
  if (!canSpeak()) return null
  const voices = await voicesNow()
  return voices.find((v) => v.lang?.toLowerCase().startsWith(code.toLowerCase())) ?? null
}

export async function speak(parts, code, onEnd = () => {}) {
  if (!canSpeak()) return false
  const voice = await voiceFor(code)
  if (!voice) return false
  window.speechSynthesis.cancel()
  const list = parts.filter(Boolean)
  list.forEach((text, i) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.rate = 0.95
    if (i === list.length - 1) utterance.onend = onEnd
    window.speechSynthesis.speak(utterance)
  })
  return true
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel()
}
