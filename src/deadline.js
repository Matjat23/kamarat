// Stops waiting after `ms`, even when a step inside has no timeout of its own
// (getting the App Check token, starting Gemini Nano). A late answer is
// ignored, and state.expired tells the work behind it not to start anything
// new. The error says "timed out", which counts as a temporary error, so the
// usual fallbacks (the backup model, Gemini Nano, the rule-based check) apply.
export function withDeadline(work, ms) {
  const state = { expired: false }
  let timer
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      state.expired = true
      reject(new Error('Gemini timed out'))
    }, ms)
  })
  return Promise.race([work(state), deadline]).finally(() => clearTimeout(timer))
}
