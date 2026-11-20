import type { Timestamp } from 'firebase/firestore'
import { gridScale } from './config'

export const publications = { draft: 'Rascunhos', published: 'Publicados', paused: 'Pausados', archived: 'Arquivados' } as const
export type Publication = keyof typeof publications
export const availabilities = { available: 'Disponível', soon: 'Em breve', occupied: 'Ocupado', closed: 'Venda encerrada' } as const
export type Availability = keyof typeof availabilities
export type ListingData = {
  city: string; ownerId: string; publication: Publication; visibility: 'normal' | 'occupied' | 'hidden'
  purpose: 'rent' | 'sale'; kind: 'house' | 'apartment'; availability: Availability
  title: string; description: string; neighborhood: string; latCell: number; lngCell: number
  price: number; condo: number | null; tax: number | null; fees: number | null
  size: number; beds: number; baths: number; parking: number
  pets: boolean; furnished: boolean; garage: boolean; accessible: boolean
  availableOn: string | null; showOccupied: boolean; contactEnabled: boolean
}
export type Listing = ListingData & { id: string; createdAt: Timestamp; updatedAt: Timestamp }
export type Draft = Omit<ListingData, 'ownerId' | 'publication' | 'visibility'>
export const kindLabel = { house: 'Casa', apartment: 'Apartamento' }
export const features = { pets: 'Aceita pets', furnished: 'Mobiliado', garage: 'Garagem', accessible: 'Acessibilidade' } as const
export const styles = {
  rent: { name: 'Para alugar', sign: 'A' },
  soon: { name: 'Em breve', sign: 'E' },
  occupied: { name: 'Ocupado', sign: 'O' },
  sale: { name: 'À venda', sign: 'V' },
} as const
export function statusStyle(item: Pick<ListingData, 'purpose' | 'availability'>) {
  if (item.availability === 'occupied' || item.availability === 'closed') return 'occupied'
  if (item.availability === 'soon') return 'soon'
  return item.purpose
}
export function visibility(item: Pick<ListingData, 'availability' | 'showOccupied'>) {
  if (item.availability === 'closed') return 'hidden'
  if (item.availability === 'occupied') return item.showOccupied ? 'occupied' : 'hidden'
  return 'normal'
}
export const position = (item: Pick<ListingData, 'latCell' | 'lngCell'>): [number, number] =>
  [item.latCell / gridScale, item.lngCell / gridScale]
export const money = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
}).format(value)
export const displayDate = (date: string) => date.split('-').reverse().join('/')
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format()
export const overdue = (item: Pick<ListingData, 'availability' | 'availableOn'>) =>
  item.availability === 'soon' && !!item.availableOn && item.availableOn < today()
export const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
export function whatsapp(value: string) {
  if (!/^[+\d ()-]+$/.test(value)) return null
  const digits = value.replace(/\D/g, '')
  const number = digits.length <= 11 ? '55' + digits : digits
  return /^55[1-9][0-9](?:9[0-9]{8}|[2-5][0-9]{7})$/.test(number) ? number : null
}
export function errorText(error: unknown) {
  const code = (error as { code?: string })?.code
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
    'auth/invalid-credential': 'Confira o e-mail e a senha.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Aguarde alguns minutos antes de tentar novamente.',
    'auth/network-request-failed': 'Não foi possível conectar. Confira sua conexão.',
    'permission-denied': 'Você não tem permissão para esta ação. Confira sua sessão e a verificação de e-mail.',
    unavailable: 'Serviço indisponível. Confira a conexão e tente novamente.',
    'not-found': 'O anúncio já não está disponível.',
    'already-exists': 'Você já denunciou este anúncio.',
  }
  return messages[code || ''] || 'Não foi possível concluir agora. Tente novamente.'
}
