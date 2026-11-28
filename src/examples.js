// Example notices for trying Katty. Every person, number and address is made up.
// The dates move with the calendar: each letter is dated a few days before the
// day it is opened, and its deadlines fall a few weeks later, so the examples
// never show a deadline that has already passed.

function daysFromToday(days) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date
}

// 2026-11-18
const isoDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

// "15 december 2026" and "November 12, 2026"
const swedishDate = (date) => date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
const usDate = (date) => date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

export const EXAMPLES = [
  {
    id: 'se-migration',
    label: 'Swedish migration letter',
    country: 'SE',
    sender: 'Migrationsverket',
    kind: 'Request for documents',
    get text() {
      return `Migrationsverket

Göteborg ${isoDate(daysFromToday(-4))}

Amina Okafor
Storgatan 14B
413 01 Göteborg

Ärendenummer: 2026-48213-07
Personnummer: 19980412-5531

Begäran om komplettering

Hej Amina Okafor,

Vi har tagit emot din ansökan om förlängning av uppehållstillstånd för studier. För att kunna fortsätta handlägga ärendet behöver vi en kopia av ditt antagningsbesked och ett intyg om studieresultat från ditt universitet.

Skicka in kompletteringen inom 14 dagar från att du har tagit emot detta brev. Om vi inte får kompletteringen kan din ansökan komma att avgöras på befintligt underlag, vilket kan leda till att den avslås.

Avgiften på 1 500 kr ska betalas senast den ${swedishDate(daysFromToday(25))}.

Du kan skicka kompletteringen via e-tjänsten på migrationsverket.se. Ange alltid ditt ärendenummer.

Har du frågor? Kontakta din handläggare Erik Lindqvist på 010-485 12 34 eller erik.lindqvist@example.se.

Med vänlig hälsning
Migrationsverket`
    },
  },
  {
    id: 'us-university',
    label: 'US university letter',
    country: 'US',
    sender: 'University international office',
    kind: 'Action before your program ends',
    get text() {
      return `Example State University
International Student and Scholar Services

${usDate(daysFromToday(-5))}

Lucas Ferreira
1420 Oak Ridge Drive, Apt 5
Gainesville, FL 32601

SEVIS ID: N0034567891
Student ID: 48201937

Subject: Action required before your program end date

Dear Lucas Ferreira,

Our records show that your I-20 program end date is ${usDate(daysFromToday(40))}. If you plan to continue your studies or apply for Optional Practical Training (OPT), you must submit a request to our office before this date.

If you apply for OPT, your application must be received by U.S. Citizenship and Immigration Services no later than 60 days after your program end date. You may not begin working until you receive your Employment Authorization Document.

Please upload your updated financial documents to the student portal within 10 business days of this notice. Incomplete requests may delay your new I-20.

If you have questions, contact your advisor Maria Gonzalez at (352) 555-0147 or mgonzalez@example.edu.

Sincerely,
International Student and Scholar Services`
    },
  },
]
