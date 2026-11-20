import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  createUserWithEmailAndPassword, onIdTokenChanged, reload, sendEmailVerification, updateProfile, type User,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

const Session = createContext({ user: null as User | null, ready: false, refresh: async () => {} })
export const useSession = () => useContext(Session)
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ user: null as User | null, ready: false })
  useEffect(() => onIdTokenChanged(auth, user => setState({ user, ready: true })), [])
  async function refresh() {
    const user = auth.currentUser
    if (user) {
      await reload(user)
      await user.getIdToken(true)
    }
    setState({ user, ready: true })
  }
  return <Session.Provider value={{ ...state, refresh }}>{children}</Session.Provider>
}
export async function register(name: string, email: string, password: string) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(user, { displayName: name })
  await setDoc(doc(db, 'profiles', user.uid), { name, updatedAt: serverTimestamp() })
  await sendEmailVerification(user)
}

