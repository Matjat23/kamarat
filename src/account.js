// Optional Google sign-in, and syncing My move between devices. Only the move
// list is stored (countries, reason, steps and ticks). Letters, papers and
// personal details never leave the device.
//
// Loaded on demand by accountState.js, so people who never sign in do not
// download Firebase Auth and Firestore.
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { deleteDoc, doc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore'
import { app } from './firebase'
import { loadMovePlan, moveChangedAt, saveMovePlan, MOVE_CHANGED } from './move'

const auth = getAuth(app)
const db = getFirestore(app)
const provider = new GoogleAuthProvider()

// Changes are sent at most this often while someone ticks steps quickly.
const PUSH_DELAY_MS = 800

let stopSync = () => {}

// update: (changes) => void, from accountState.js.
export function start(update) {
  onAuthStateChanged(auth, (user) => {
    stopSync()
    if (!user) {
      update({ status: 'signed-out', name: '' })
      return
    }
    update({ status: 'signed-in', name: user.displayName || user.email || '', syncError: false })
    stopSync = syncMove(user.uid, update)
  })
}

export const signIn = () => signInWithPopup(auth, provider)
export const signOutOfAccount = () => signOut(auth)

// Deletes the synced list and the account. The list stays on this device.
export async function deleteAccount() {
  const user = auth.currentUser
  if (!user) return
  await deleteDoc(doc(db, 'moves', user.uid))
  try {
    await user.delete()
  } catch (err) {
    if (err.code !== 'auth/requires-recent-login') throw err
    await reauthenticateWithPopup(user, provider)
    await user.delete()
  }
}

// One document per person: { plan, changedAt }. The newer side wins, on
// sign-in and whenever either side changes.
function syncMove(uid, update) {
  const ref = doc(db, 'moves', uid)
  let timer = null

  async function push() {
    const plan = loadMovePlan()
    try {
      await setDoc(ref, {
        // JSON round trip: Firestore refuses undefined values.
        plan: plan && !plan.example ? JSON.parse(JSON.stringify(plan)) : null,
        changedAt: moveChangedAt() || Date.now(),
      })
      update({ syncError: false })
    } catch (err) {
      console.warn('Could not sync My move.', err)
      update({ syncError: true })
    }
  }

  function onLocalChange(event) {
    if (event.detail?.fromSync) return
    clearTimeout(timer)
    timer = setTimeout(push, PUSH_DELAY_MS)
  }

  let first = true
  const unsubscribe = onSnapshot(
    ref,
    (snap) => {
      const remote = snap.exists() ? snap.data() : null
      const isFirst = first
      first = false
      if (snap.metadata.hasPendingWrites) return
      const local = moveChangedAt()
      if (remote && remote.changedAt > local) {
        saveMovePlan(remote.plan ?? null, { changedAt: remote.changedAt, fromSync: true })
      } else if (isFirst && (!remote || local > remote.changedAt) && loadMovePlan()) {
        push()
      }
    },
    (err) => {
      console.warn('Could not read the synced My move.', err)
      update({ syncError: true })
    },
  )
  window.addEventListener(MOVE_CHANGED, onLocalChange)

  return () => {
    clearTimeout(timer)
    unsubscribe()
    window.removeEventListener(MOVE_CHANGED, onLocalChange)
  }
}
