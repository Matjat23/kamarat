// Dates on screen, written the way the screen language writes them.
import { dateLocale } from './i18n'

export function formatDate(date, options) {
  return date.toLocaleDateString(dateLocale(), options)
}

// "3 Dec"
export function shortDate(date) {
  return formatDate(date, { day: 'numeric', month: 'short' })
}

// "3 Dec 2026"
export function shortDateWithYear(date) {
  return formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' })
}

// "Thursday, 3 December 2026"
export function longDate(date) {
  return formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
