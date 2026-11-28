// Gemini's free tier has a daily request limit per model. When a model says the
// day's limit is used up, Katty stops asking it until the limit resets
// (midnight US Pacific time) instead of failing on every try.

const KEY = 'katty.quota.v1'

export class QuotaError extends Error {
  constructor() {
    super(
      "Katty has used today's free Gemini requests. They reset every day at midnight US Pacific time. Please try again later",
    )
    this.quota = true
  }
}

// The quota day, which follows Pacific time.
function quotaDay() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return saved?.day === quotaDay() && Array.isArray(saved.models) ? saved.models : []
  } catch {
    return []
  }
}

// A 429 that names a daily limit, for example
// "Generate content requests per day limit exceeded on Free Tier".
export function isDailyLimit(err) {
  const message = err?.message ?? ''
  return /\b429\b|quota|resource.?exhausted/i.test(message) && /per.?day|daily|PerDay/i.test(message)
}

export function markUsedUp(model) {
  const models = [...new Set([...read(), model])]
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: quotaDay(), models }))
  } catch {
    // Private mode: Katty just tries again next time.
  }
}

export function usableModels(models) {
  const usedUp = read()
  return models.filter((m) => !usedUp.includes(m))
}
