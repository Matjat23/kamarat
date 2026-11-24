// Reading the explanation aloud with the voices built into the device.
// Only voices that run on the device are used. Some browsers also offer online
// voices, which send the text to a speech server, so Kamarat skips those.

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function voicesNow() {
  return new Promise((resolve) => {
    const list = window.speechSynthesis.getVoices()
    if (list.length) return resolve(list)
    const done = () => resolve(window.speechSynthesis.getVoices())
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, 1000)
  })
}

// Finds an on-device voice for the language, for example "sv" matches "sv-SE".
export async function voiceFor(code) {
  if (!canSpeak()) return null
  const voices = await voicesNow()
  return (
    voices.find((v) => v.localService && v.lang?.toLowerCase().replace('_', '-').startsWith(code.toLowerCase())) ??
    null
  )
}

// Speaks the parts one after another. onEnd runs once, when the last part is
// finished or when speaking stops because of an error.
export async function speak(parts, code, onEnd = () => {}) {
  if (!canSpeak()) return false
  const voice = await voiceFor(code)
  if (!voice) return false
  window.speechSynthesis.cancel()
  const list = parts.filter(Boolean)
  let ended = false
  const finish = () => {
    if (ended) return
    ended = true
    onEnd()
  }
  list.forEach((text, i) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.rate = 0.95
    if (i === list.length - 1) utterance.onend = finish
    utterance.onerror = (event) => {
      if (event.error !== 'interrupted' && event.error !== 'canceled') console.warn('Speech failed:', event.error)
      window.speechSynthesis.cancel()
      finish()
    }
    window.speechSynthesis.speak(utterance)
  })
  return true
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel()
}

// A few fixed sentences for the spoken summary, in the languages Kamarat can
// say them in correctly. Other languages hear only the AI's own text and dates.
const PHRASES = {
  en: { by: (d) => `By ${d}.`, check: 'Check this date in your letter.', unknown: 'The date is not known yet.' },
  sv: { by: (d) => `Senast ${d}.`, check: 'Kontrollera datumet i ditt brev.', unknown: 'Datumet är inte känt än.' },
  fr: { by: (d) => `Au plus tard le ${d}.`, check: 'Vérifiez cette date dans votre courrier.', unknown: "La date n'est pas encore connue." },
  es: { by: (d) => `Como muy tarde el ${d}.`, check: 'Compruebe esta fecha en su carta.', unknown: 'La fecha todavía no se conoce.' },
  de: { by: (d) => `Spätestens am ${d}.`, check: 'Prüfen Sie dieses Datum in Ihrem Schreiben.', unknown: 'Das Datum ist noch nicht bekannt.' },
}

export function spokenPhrases(code) {
  return PHRASES[code] ?? null
}

export function spokenDate(date, code) {
  try {
    return date.toLocaleDateString(code, { weekday: 'long', day: 'numeric', month: 'long' })
  } catch {
    return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  }
}
