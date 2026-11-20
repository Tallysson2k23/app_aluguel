import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Bath, BedDouble, CarFront, Heart, House, Image, MapPin, Maximize, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { onSnapshot } from 'firebase/firestore'
import { favoriteRef, setFavorite } from './data'
import { displayDate, errorText, kindLabel, money, statusStyle, styles, type Listing } from './domain'
import { useSession } from './session'

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={'notice' + (error ? ' error' : '')} role={error ? 'alert' : 'status'}>{children}</div>
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty"><House size={28} aria-hidden="true" /><h3>{title}</h3><div>{children}</div></div>
}
export function Photo({ item }: { item: Pick<Listing, 'purpose' | 'availability'> }) {
  return <div className={'photo ' + statusStyle(item)}><span className="photo-icon"><Image size={21} aria-hidden="true" /></span>
    <span>As fotos deste imóvel aparecerão aqui futuramente</span></div>
}
export function Badge({ item }: { item: Pick<Listing, 'purpose' | 'availability' | 'availableOn'> }) {
  const key = statusStyle(item)
  return <span className={'badge ' + key}><span className="status-dot" />{item.availability === 'closed' ? 'Venda encerrada' : styles[key].name}
    {item.availableOn && ' · ' + displayDate(item.availableOn)}</span>
}
export function Specs({ item }: { item: Pick<Listing, 'beds' | 'baths' | 'parking' | 'size'> }) {
  return <div className="specs">
    <span><BedDouble />{item.beds} <span className="spec-label">quartos</span></span>
    <span><Bath />{item.baths} <span className="spec-label">banheiros</span></span>
    <span><CarFront />{item.parking} <span className="spec-label">vagas</span></span>
    <span><Maximize />{item.size} m²</span>
  </div>
}
export function Price({ item }: { item: Pick<Listing, 'price' | 'purpose'> }) {
  return <div className="price">{money(item.price)}{item.purpose === 'rent' && <small> / mês</small>}</div>
}
export function LoginLink({ children, className }: { children: ReactNode; className?: string }) {
  const location = useLocation()
  return <Link className={className || 'button primary'} to="/perfil" state={{ next: location.pathname }}>{children}</Link>
}
export function Favorite({ id, onChange }: { id: string; onChange?: (value: boolean) => void }) {
  const { user } = useSession()
  const [selected, setSelected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setSelected(false)
    if (user) return onSnapshot(favoriteRef(user.uid, id), snap => setSelected(snap.exists()), err => setError(errorText(err)))
  }, [user, id])
  if (!user) return <LoginLink className="icon-button"><Heart aria-label="Entrar para favoritar" size={19} /></LoginLink>
  async function toggle() {
    if (!user || busy) return
    setBusy(true)
    setError('')
    try {
      await setFavorite(user.uid, id, !selected)
      onChange?.(!selected)
    } catch (err) { setError(errorText(err)) }
    finally { setBusy(false) }
  }
  return <><button type="button" className={'icon-button ' + (selected ? 'favorited' : '')} aria-label={selected ? 'Remover favorito' : 'Salvar favorito'}
    aria-pressed={selected} disabled={busy} onClick={toggle}><Heart size={19} fill={selected ? 'currentColor' : 'none'} /></button>
    {error && <span className="inline-error" role="alert">{error}</span>}</>
}
export function ListingCard({ item, active, onSelect, onFavorite }: {
  item: Listing; active?: boolean; onSelect?: () => void; onFavorite?: (value: boolean) => void
}) {
  const location = useLocation()
  return <article className={'listing-card ' + (active ? 'selected' : '')}>
    <div className="card-top"><Photo item={item} /><div className="card-favorite"><Favorite id={item.id} onChange={onFavorite} /></div></div>
    <div className="card-body">
      <div className="card-meta"><Badge item={item} /><span>{kindLabel[item.kind]}</span></div>
      <h3><Link to={'/imovel/' + item.id} state={{ fromExplore: location.pathname === '/' }}>{item.title}</Link></h3>
      <div className="muted location"><MapPin size={14} aria-hidden="true" />{item.neighborhood}</div>
      <Price item={item} />
      <Specs item={item} />
      {onSelect && <button className="text-button small" type="button" onClick={onSelect}>Localizar no mapa</button>}
    </div>
  </article>
}
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="dialog-head"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>
}
