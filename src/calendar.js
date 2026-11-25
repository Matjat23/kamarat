// Makes a calendar file (.ics) for a deadline. It works with Google Calendar,
// Outlook and Apple Calendar. The file is built in the browser and never uploaded.

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

export function makeDeadlineFile({ title, date, details }) {
  const end = new Date(date)
  end.setDate(end.getDate() + 1)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Katty//Deadline//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@kamarat`,
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
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

export function downloadDeadline({ title, date, details }) {
  const blob = new Blob([makeDeadlineFile({ title, date, details })], {
    type: 'text/calendar;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `kamarat-deadline-${dayStamp(date)}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
