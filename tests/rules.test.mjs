import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

let env
const city = 'santa-cruz-do-capibaribe-pe'
const listing = (ownerId, overrides = {}) => ({
  city, ownerId, publication: 'published', visibility: 'normal', purpose: 'rent', kind: 'house',
  availability: 'available', title: 'Casa com dois quartos', description: 'Casa térrea com varanda e garagem.', neighborhood: 'Centro',
  latCell: -3977, lngCell: -18102, price: 1000, size: 90, beds: 2, baths: 1, parking: 1,
  condo: null, tax: null, fees: null, pets: true, furnished: false, garage: true, accessible: false,
  availableOn: null, showOccupied: false, contactEnabled: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...overrides,
})
const db = (uid, email_verified = true) => uid
  ? env.authenticatedContext(uid, { email_verified }).firestore() : env.unauthenticatedContext().firestore()
const ref = (db, id = 'public') => doc(db, 'listings', id)
const contact = (db, id = 'public') => doc(db, 'contacts', id)
const phone = { ownerId: 'owner', phone: '5581990000000' }
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-aluguel-map-rules', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
  await env.withSecurityRulesDisabled(async ctx => {
    const store = ctx.firestore()
    const batch = writeBatch(store)
    batch.set(ref(store), listing('owner', { contactEnabled: true }))
    batch.set(contact(store), { ...phone, updatedAt: serverTimestamp() })
    batch.set(ref(store, 'draft'), listing('owner', { publication: 'draft' }))
    batch.set(ref(store, 'paused'), listing('owner', { publication: 'paused', contactEnabled: true }))
    batch.set(contact(store, 'paused'), { ...phone, updatedAt: serverTimestamp() })
    batch.set(ref(store, 'occupied'), listing('owner', { availability: 'occupied', visibility: 'occupied', showOccupied: true }))
    batch.set(ref(store, 'hidden'), listing('owner', { availability: 'occupied', visibility: 'hidden' }))
    batch.set(ref(store, 'closed'), listing('owner', { purpose: 'sale', availability: 'closed', visibility: 'hidden' }))
    batch.set(ref(store, 'disabled'), listing('owner'))
    batch.set(contact(store, 'disabled'), { ...phone, updatedAt: serverTimestamp() })
    await batch.commit()
  })
})
after(async () => { await env?.cleanup() })

test('visitante lê publicados com filtros obrigatórios, área e limite; ocupados exigem opt-in na busca', async () => {
  const guest = db()
  const source = collection(guest, 'listings')
  const area = [
    where('city', '==', city), where('publication', '==', 'published'),
    where('latCell', '>=', -3989), where('latCell', '<=', -3950),
    where('lngCell', '>=', -18118), where('lngCell', '<=', -18090), orderBy('latCell'), orderBy('lngCell'),
  ]
  const result = await assertSucceeds(getDocs(query(source, where('visibility', '==', 'normal'), ...area, limit(25))))
  assert.deepEqual(result.docs.map(d => d.id).sort(), ['disabled', 'public'])
  const extra = await assertSucceeds(getDocs(query(source, where('visibility', 'in', ['normal', 'occupied']), ...area, limit(25))))
  assert.ok(extra.docs.some(d => d.id === 'occupied'))
  await assertFails(getDocs(query(source, ...area, limit(25))))
  await assertFails(getDocs(query(source, where('visibility', '==', 'normal'), ...area)))
})

test('rascunhos, pausados, vendas encerradas e ocupados sem autorização são privados', async () => {
  for (const id of ['draft', 'paused', 'hidden', 'closed']) {
    await assertFails(getDoc(ref(db(), id)))
    await assertFails(getDoc(ref(db('other'), id)))
    await assertSucceeds(getDoc(ref(db('owner'), id)))
  }
  await assertSucceeds(getDocs(query(collection(db('owner'), 'listings'), where('ownerId', '==', 'owner'), orderBy('updatedAt', 'desc'), limit(25))))
})

test('só o proprietário edita e o identificador do proprietário é imutável', async () => {
  await assertFails(updateDoc(ref(db('other')), { title: 'Anúncio adulterado', updatedAt: serverTimestamp() }))
  await assertFails(updateDoc(ref(db('owner')), { ownerId: 'other', updatedAt: serverTimestamp() }))
  await assertFails(updateDoc(ref(db('owner')), { exactAddress: 'Rua 1', updatedAt: serverTimestamp() }))
  await assertFails(updateDoc(ref(db('owner')), { latCell: -3977.123, updatedAt: serverTimestamp() }))
  await assertFails(updateDoc(ref(db('owner')), { visibility: 'occupied', updatedAt: serverTimestamp() }))
  await assertSucceeds(updateDoc(ref(db('owner')), { title: 'Casa com varanda e garagem', updatedAt: serverTimestamp() }))
})

test('conta sem verificação pode criar rascunho e não pode publicar', async () => {
  const unverified = db('new', false)
  await assertFails(setDoc(ref(unverified, 'new-public'), listing('new')))
  await assertSucceeds(setDoc(ref(unverified, 'new-draft'), listing('new', { publication: 'draft' })))
  await assertFails(updateDoc(ref(unverified, 'new-draft'), { publication: 'published', updatedAt: serverTimestamp() }))
  await assertSucceeds(updateDoc(ref(db('new'), 'new-draft'), { publication: 'published', updatedAt: serverTimestamp() }))
})

test('contato autorizado requer conta verificada e anúncio publicamente elegível', async () => {
  await assertFails(getDoc(contact(db())))
  await assertFails(getDoc(contact(db('other', false))))
  await assertSucceeds(getDoc(contact(db('other'))))
  await assertFails(getDoc(contact(db('other'), 'paused')))
  await assertFails(getDoc(contact(db('other'), 'disabled')))
  await assertSucceeds(getDoc(contact(db('owner'), 'draft')))
  await assertFails(getDocs(query(collection(db('other'), 'contacts'), limit(25))))
  await assertFails(setDoc(contact(db('other'), 'draft'), { ownerId: 'other', phone: phone.phone, updatedAt: serverTimestamp() }))
})

test('ativar contato exige contato válido no mesmo lote ou já existente', async () => {
  const store = db('atomic')
  const id = 'atomic'
  const record = listing('atomic', { publication: 'draft', contactEnabled: true })
  await assertFails(setDoc(ref(store, id), record))
  const batch = writeBatch(store)
  batch.set(ref(store, id), record)
  batch.set(contact(store, id), { ownerId: 'atomic', phone: phone.phone, updatedAt: serverTimestamp() })
  await assertSucceeds(batch.commit())
})

test('favoritos, perfil e denúncias são privados, e a denúncia só é criada uma vez', async () => {
  const store = db('reporter', false)
  const favorite = store => doc(store, 'profiles', 'reporter', 'favorites', 'public')
  const report = store => doc(store, 'reports', 'public', 'submissions', 'reporter')
  await assertSucceeds(setDoc(favorite(store), { createdAt: serverTimestamp() }))
  await assertFails(getDoc(favorite(db('other'))))
  await assertFails(setDoc(doc(store, 'profiles', 'reporter'), { name: 'Perfil', role: 'moderator', updatedAt: serverTimestamp() }))
  await assertSucceeds(setDoc(doc(store, 'profiles', 'reporter'), { name: 'Perfil', updatedAt: serverTimestamp() }))
  await assertFails(getDoc(doc(db('other'), 'profiles', 'reporter')))
  await assertSucceeds(setDoc(report(store), { reason: 'Outro', createdAt: serverTimestamp() }))
  await assertFails(setDoc(report(store), { reason: 'Outro', createdAt: serverTimestamp() }))
  await assertFails(getDoc(report(store)))
})


