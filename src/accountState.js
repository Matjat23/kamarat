// Who is signed in, for the screens. The sign-in code itself (account.js) is
// only loaded when someone signs in, or was signed in on this device before.
import { useSyncExternalStore } from 'react'
import { msg } from './i18n'

export const SIGNED_IN_KEY = 'katty.account'

// status: 'signed-out' | 'busy' | 'signed-in'. error: a msg() key or ''.
let state = { status: 'signed-out', name: '', error: '', syncError: false }
const listeners = new Set()

function update(changes) {
  state = { ...state, ...changes }
  try {
    if (changes.status === 'signed-in') localStorage.setItem(SIGNED_IN_KEY, '1')
    if (changes.status === 'signed-out') localStorage.removeItem(SIGNED_IN_KEY)
  } catch {
    // Without storage the session is not restored on the next visit.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useAccount = () => useSyncExternalStore(subscribe, () => state)

let accountModule = null
function loadAccount() {
  accountModule ??= import('./account')
    .then((account) => {
      account.start(update)
      return account
    })
    .catch((err) => {
      accountModule = null
      throw err
    })
  return accountModule
}

function errorFor(err) {
  switch (err?.code) {
    case 'katty/sign-in-again':
      return msg('For safety, sign out, sign in again, then delete your account.')
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return ''
    case 'auth/popup-blocked':
      return msg('Allow pop-ups for this site, then try again.')
    case 'auth/network-request-failed':
      return msg('There is no connection right now. Please try again later.')
    default:
      return msg('Sign-in did not work. Please try again.')
  }
}

async function run(action, { restore = 'signed-out' } = {}) {
  const before = state.status
  update({ status: 'busy', error: '' })
  try {
    const account = await loadAccount()
    await action(account)
  } catch (err) {
    console.warn('Account action failed.', err)
    update({ status: before === 'busy' ? restore : before, error: errorFor(err) })
  }
}

// Loads the sign-in code without changing anything on screen.
export function loadSignIn() {
  loadAccount().catch((err) => console.warn('Could not load sign-in.', err))
}

export const signIn = () => run((account) => account.signIn())
export const signOut = () => run((account) => account.signOutOfAccount())
export const deleteAccount = () => run((account) => account.deleteAccount())

// Restore the session of someone who signed in on an earlier visit. If the
// code cannot load (offline), show signed out but try again next visit.
try {
  if (localStorage.getItem(SIGNED_IN_KEY)) {
    state = { ...state, status: 'busy' }
    loadAccount().catch(() => {
      state = { ...state, status: 'signed-out' }
      listeners.forEach((listener) => listener())
    })
  }
} catch {
  // Storage blocked: start signed out.
}
