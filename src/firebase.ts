import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const env = import.meta.env
export const localMode = env.VITE_USE_EMULATORS === 'true' || (env.DEV && env.VITE_USE_EMULATORS !== 'false')
const config = localMode ? { projectId: 'demo-aluguel-map', apiKey: 'demo-key', appId: 'demo-app' } : {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
}
const app = initializeApp(config)
export const auth = getAuth(app)
auth.languageCode = 'pt-BR'
export const db = getFirestore(app)
if (localMode) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
