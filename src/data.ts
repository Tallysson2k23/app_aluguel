import {
  collection, doc, getDoc, getDocFromServer, getDocs, query, where, orderBy, startAfter, limit,
  serverTimestamp, setDoc, deleteDoc, runTransaction, onSnapshot,
  type DocumentData, type QueryDocumentSnapshot, type QueryConstraint, type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { city, gridScale, type Area } from './config'
import { visibility, type Draft, type Listing, type Publication } from './domain'

const listings = collection(db, 'listings')
export const newListingId = () => doc(listings).id
const fromDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): Listing =>
  ({ ...snapshot.data(), id: snapshot.id } as Listing)
export type Cursor = QueryDocumentSnapshot<DocumentData>
const pageSize = 24
async function page(constraints: QueryConstraint[], after?: Cursor) {
  const result = await getDocs(query(listings, ...constraints, ...(after ? [startAfter(after)] : []), limit(pageSize + 1)))
  const docs = result.docs.slice(0, pageSize)
  return { items: docs.map(fromDoc), next: result.size > pageSize ? docs.at(-1) : undefined }
}
export function publicPage(area: Area, occupied: boolean, after?: Cursor) {
  return page([
    where('city', '==', city.id), where('publication', '==', 'published'),
    occupied ? where('visibility', 'in', ['normal', 'occupied']) : where('visibility', '==', 'normal'),
    where('latCell', '>=', Math.ceil(area.south * gridScale)),
    where('latCell', '<=', Math.floor(area.north * gridScale)),
    where('lngCell', '>=', Math.ceil(area.west * gridScale)),
    where('lngCell', '<=', Math.floor(area.east * gridScale)),
    orderBy('latCell'), orderBy('lngCell'),
  ], after)
}
export const ownerPage = (uid: string, after?: Cursor) =>
  page([where('ownerId', '==', uid), orderBy('updatedAt', 'desc')], after)
export async function getListing(id: string) {
  const snapshot = await getDoc(doc(listings, id))
  return snapshot.exists() ? fromDoc(snapshot) : null
}
export function watchListing(id: string, set: (value: Listing | null) => void, fail: () => void) {
  return onSnapshot(doc(listings, id), snapshot => set(snapshot.exists() ? fromDoc(snapshot) : null), fail)
}
export async function getContact(id: string) {
  return (await getDocFromServer(doc(db, 'contacts', id))).data()?.phone as string | undefined
}
export async function saveListing(
  id: string, uid: string, data: Draft, publication: Publication, phone: string | null, previous?: Timestamp,
) {
  const ref = doc(listings, id)
  const contactRef = doc(db, 'contacts', id)
  await runTransaction(db, async tx => {
    // For new IDs the transaction only writes. Existing IDs have a readable owner document.
    const snapshot = previous ? await tx.get(ref) : null
    if (snapshot && (!snapshot.exists() || !previous?.isEqual(snapshot.data().updatedAt))) {
      throw new Error('Este anúncio mudou em outra tela. Reabra o anúncio antes de editar.')
    }
    const visible = visibility(data)
    tx.set(ref, {
      ...data, ownerId: uid, publication, visibility: visible,
      contactEnabled: Boolean(data.contactEnabled && phone && visible === 'normal'),
      createdAt: snapshot?.data()?.createdAt ?? serverTimestamp(), updatedAt: serverTimestamp(),
    })
    if (phone) tx.set(contactRef, { ownerId: uid, phone, updatedAt: serverTimestamp() })
    else if (previous) {
      // A missing contact is not readable under the owner rule, so only delete known contacts.
      // The editor supplies an empty string specifically when removing an existing number.
      if (phone === '') tx.delete(contactRef)
    }
  })
}
export async function changePublication(item: Listing, publication: Publication) {
  const ref = doc(listings, item.id)
  await runTransaction(db, async tx => {
    const current = await tx.get(ref)
    if (!current.exists() || !item.updatedAt.isEqual(current.data().updatedAt)) {
      throw new Error('O anúncio mudou. Atualize a lista e tente novamente.')
    }
    tx.update(ref, { publication, updatedAt: serverTimestamp() })
  })
}
export const favoriteRef = (uid: string, id: string) => doc(db, 'profiles', uid, 'favorites', id)
export const setFavorite = (uid: string, id: string, value: boolean) => value
  ? setDoc(favoriteRef(uid, id), { createdAt: serverTimestamp() })
  : deleteDoc(favoriteRef(uid, id))
export async function favoritePage(uid: string, after?: Cursor) {
  const snapshot = await getDocs(query(collection(db, 'profiles', uid, 'favorites'),
    orderBy('createdAt', 'desc'), ...(after ? [startAfter(after)] : []), limit(pageSize + 1)))
  const docs = snapshot.docs.slice(0, pageSize)
  return { ids: docs.map(d => d.id), next: snapshot.size > pageSize ? docs.at(-1) : undefined }
}
export const reportReasons = ['Fraude ou golpe', 'Informações incorretas', 'Conteúdo inadequado', 'Outro']
export const reportListing = (uid: string, id: string, reason: string) =>
  setDoc(doc(db, 'reports', id, 'submissions', uid), { reason, createdAt: serverTimestamp() })


