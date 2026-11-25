// Small helpers about the device Katty runs on.

import { t } from './i18n'

export function isPhone() {
  if (typeof navigator === 'undefined') return false
  if (navigator.userAgentData?.mobile) return true
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

// Reads text the person copied, for example from an email app.
// Browsers only allow this after a tap, and may ask for permission.
export async function readClipboard() {
  if (!navigator.clipboard?.readText) {
    throw new Error(t('This browser cannot read the clipboard. Long-press the text box and choose Paste.'))
  }
  return navigator.clipboard.readText()
}
