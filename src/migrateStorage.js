// Before the rename to Katty, saved data used "kamarat." keys. Move it once,
// before any module reads storage, so nobody loses their papers or settings.
const OLD_PREFIX = 'kamarat.'
const NEW_PREFIX = 'katty.'

try {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(OLD_PREFIX)) continue
    const renamed = NEW_PREFIX + key.slice(OLD_PREFIX.length)
    if (localStorage.getItem(renamed) === null) localStorage.setItem(renamed, localStorage.getItem(key))
    localStorage.removeItem(key)
  }
} catch {
  // Storage is blocked (private mode): there is nothing to move.
}
