// How worried to be about a notice. The AI gives a first guess, then the code
// checks it against facts it can verify, so the banner, Listen and My papers
// always agree.
// - The AI's level only counts if its quote is really in the notice.
//   Otherwise a calm level becomes UNSURE (a serious one is never lowered).
// - A deadline that has passed or is less than a week away is always URGENT.
// - Something still to do, or a deadline Kamarat cannot work out yet, means
//   it is not "just information".

export const WORRY = {
  INFO: {
    short: 'Just information',
    title: 'Good news: this is just information.',
    help: '',
  },
  ACTION: {
    short: 'Action needed',
    title: 'This needs something from you, but it is routine.',
    help: '',
  },
  UNSURE: {
    short: 'Read carefully',
    title: "Kamarat isn't sure how serious this is.",
    help: 'Read the letter carefully. If you are unsure, ask the sender or someone you trust.',
  },
  URGENT: {
    short: 'Time-sensitive',
    title: "This one is time-sensitive. Let's not wait.",
    help: '',
  },
  HELP: {
    short: 'Get help',
    title: "This is serious. You don't have to handle it alone.",
    help: "Consider talking to a person before the deadline: the sender's customer service, a free legal aid service, or your school's or employer's support. You can show them this page.",
  },
}

const RANK = { INFO: 0, ACTION: 1, UNSURE: 2, URGENT: 3, HELP: 4 }

export function daysUntil(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return Math.round((day - today) / 86400000)
}

// worry: what the AI said ({ level, reason, quote, quoteFound }).
// actions: [{ group, done, info }] where info comes from resolveDeadline.
// Returns { level, reason, quote, raised } where raised explains a change.
export function assessWorry(worry, actions) {
  const aiLevel = RANK[worry?.level] !== undefined && worry.level !== 'UNSURE' ? worry.level : null
  const trusted = Boolean(aiLevel && worry.quoteFound)
  let level = aiLevel ?? 'UNSURE'
  let raised = null

  if (aiLevel && !trusted && RANK[aiLevel] < RANK.UNSURE) {
    level = 'UNSURE'
    raised = 'Kamarat could not find the sentence this was based on, so it is being careful.'
  }

  const open = actions.filter((a) => a.group !== 'CHECK' && !a.done)
  const dates = open.filter((a) => a.info?.date).map((a) => daysUntil(a.info.date))
  const soonest = dates.length ? Math.min(...dates) : null

  if (soonest !== null && soonest < 0 && RANK[level] < RANK.URGENT) {
    level = 'URGENT'
    raised = 'Kamarat raised this because a deadline has already passed.'
  } else if (soonest !== null && soonest <= 7 && RANK[level] < RANK.URGENT) {
    level = 'URGENT'
    raised = 'Kamarat raised this because a deadline is less than a week away.'
  } else if (level === 'INFO') {
    const unknownDate = open.some((a) => a.info && !a.info.date)
    const mustDo = open.some((a) => a.group === 'MUST')
    if (unknownDate || mustDo) {
      level = 'ACTION'
      raised = unknownDate
        ? 'Kamarat raised this because there is a deadline it cannot work out yet.'
        : 'Kamarat raised this because the letter asks you to do something.'
    }
  }

  return {
    level,
    raised,
    reason: worry?.reason ?? '',
    quote: trusted ? worry.quote : '',
  }
}
