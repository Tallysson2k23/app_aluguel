import { initializeApp, deleteApp } from 'firebase/app'
import { applyActionCode, connectAuthEmulator, createUserWithEmailAndPassword, getAuth, reload, sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, writeBatch } from 'firebase/firestore'

const projectId = 'demo-aluguel-map'
const authUrl = 'http://127.0.0.1:9099'
const email = 'anunciante@example.test'
const password = 'Demonstracao!2026'
const app = initializeApp({ projectId, apiKey: 'demo-key' })
const auth = getAuth(app)
const db = getFirestore(app)
connectAuthEmulator(auth, authUrl, { disableWarnings: true })
connectFirestoreEmulator(db, '127.0.0.1', 8080)

const samples = [
  ['apartamento-centro', 'Apartamento iluminado no Centro', 'Centro', 'apartment', 'rent', 'available', 1150, 62, 2, -3977, -18100],
  ['casa-bela-vista', 'Casa térrea com varanda', 'Bela Vista', 'house', 'rent', 'soon', 1600, 96, 3, -3974, -18104],
  ['casa-nova-santa-cruz', 'Casa com quintal e garagem', 'Nova Santa Cruz', 'house', 'sale', 'available', 345000, 118, 3, -3980, -18105],
  ['apartamento-sao-cristovao', 'Apartamento com dois quartos', 'São Cristóvão', 'apartment', 'rent', 'occupied', 980, 58, 2, -3979, -18099],
  ['casa-santo-agostinho', 'Casa perto do comércio', 'Santo Agostinho', 'house', 'rent', 'available', 1350, 85, 2, -3976, -18107],
  ['apartamento-nova-santa-cruz', 'Apartamento com varanda', 'Nova Santa Cruz', 'apartment', 'sale', 'available', 235000, 72, 2, -3981, -18101],
  ['casa-centro', 'Casa com garagem no Centro', 'Centro', 'house', 'rent', 'soon', 2100, 124, 3, -3976, -18097],
  ['casa-malhada', 'Casa com área externa', 'Malhada do Meio', 'house', 'rent', 'available', 900, 75, 2, -3973, -18100],
]
try {
  await fetch(authUrl + '/emulator/v1/projects/' + projectId + '/oobCodes')
  let user
  try { ({ user } = await createUserWithEmailAndPassword(auth, email, password)) }
  catch (error) {
    if (error.code !== 'auth/email-already-in-use') throw error
    ;({ user } = await signInWithEmailAndPassword(auth, email, password))
  }
  if (!user.emailVerified) {
    await sendEmailVerification(user)
    const response = await fetch(authUrl + '/emulator/v1/projects/' + projectId + '/oobCodes')
    const { oobCodes } = await response.json()
    const verification = oobCodes.findLast(entry => entry.email === email && entry.requestType === 'VERIFY_EMAIL')
    await applyActionCode(auth, verification.oobCode)
    await reload(user)
    await user.getIdToken(true)
  }
  const batch = writeBatch(db)
  batch.set(doc(db, 'profiles', user.uid), { name: 'Anunciante de demonstração', updatedAt: serverTimestamp() })
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + 21)
  for (const [id, title, neighborhood, kind, purpose, availability, price, size, beds, latCell, lngCell] of samples) {
    const listing = doc(db, 'listings', id)
    let previous
    try { previous = await getDoc(listing) }
    catch (error) { if (error.code !== 'permission-denied') throw error }
    if (previous?.exists()) continue
    const enabled = id === 'apartamento-centro' || id === 'casa-bela-vista'
    if (enabled) batch.set(doc(db, 'contacts', id), { ownerId: user.uid, phone: '5581990000000', updatedAt: serverTimestamp() })
    batch.set(listing, {
      city: 'santa-cruz-do-capibaribe-pe', ownerId: user.uid, publication: 'published',
      visibility: availability === 'occupied' ? 'occupied' : 'normal', purpose, kind, availability, title, neighborhood,
      description: 'Imóvel de demonstração com boa ventilação e fácil acesso aos serviços do bairro. Dados fictícios para testar a busca e os filtros.',
      latCell, lngCell, price, condo: kind === 'apartment' ? 160 : null, tax: null, fees: null, size, beds,
      baths: beds > 2 ? 2 : 1, parking: 1, pets: kind === 'house', furnished: id === 'apartamento-centro',
      garage: true, accessible: kind === 'house', availableOn: availability === 'soon' ? date.toISOString().slice(0, 10) : null,
      showOccupied: availability === 'occupied', contactEnabled: enabled, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
  console.log('Demonstração pronta. Conta local: ' + email + ' / ' + password)
} catch (error) {
  console.error('Falha ao popular o emulador local. Inicie o Emulator Suite primeiro.', error)
  process.exitCode = 1
} finally {
  await deleteApp(app)
}
