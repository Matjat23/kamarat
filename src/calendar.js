// Makes a calendar file (.ics) with one or more deadlines. It works with Google
// Calendar, Outlook and Apple Calendar. The file is built in the browser and
// never uploaded.
import { t } from './i18n'

// The text under a deadline in the calendar: what to do, the quote it comes
// from, and how the date was worked out.
export function deadlineDetails(action, sender) {
  return `${action.explanation}\n\n${t('From {sender}', { sender })}: "${action.quote}"\n\n${action.info.basis}\n${t('Made with Katty. Always check the original letter.')}`
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function dayStamp(day) {
  return `${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}`
}

function nowStamp() {
  const d = new Date()
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

// Calendar files need commas, semicolons and line breaks escaped.
function escapeText(text) {
  return (text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function deadlineEvent({ title, date, details }) {
  const end = new Date(date)
  end.setDate(end.getDate() + 1)
  return [
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@katty-buddy.web.app`,
    `DTSTAMP:${nowStamp()}`,
    `DTSTART;VALUE=DATE:${dayStamp(date)}`,
    `DTEND;VALUE=DATE:${dayStamp(end)}`,
    `SUMMARY:${escapeText(`Deadline: ${title}`)}`,
    `DESCRIPTION:${escapeText(details)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`In 3 days: ${title}`)}`,
    'TRIGGER:-P3D',
    'END:VALARM',
    'END:VEVENT',
  ]
}

// deadlines: [{ title, date, details }]
export function makeDeadlineFile(deadlines) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Katty//Deadline//EN',
    'CALSCALE:GREGORIAN',
    ...deadlines.flatMap(deadlineEvent),
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

export function downloadDeadlines(deadlines) {
  if (deadlines.length === 0) return
  const blob = new Blob([makeDeadlineFile(deadlines)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = deadlines.length === 1 ? `katty-deadline-${dayStamp(deadlines[0].date)}.ics` : 'katty-deadlines.ics'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadDeadline = (deadline) => downloadDeadlines([deadline])
