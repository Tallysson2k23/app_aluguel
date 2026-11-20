import { useEffect, useState } from 'react'
import { ArrowLeft, Archive, ExternalLink, Pause, Plus } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { changePublication, favoritePage, getListing, ownerPage, type Cursor } from './data'
import { errorText, overdue, publications, type Listing, type Publication } from './domain'
import { useSession } from './session'
import { Badge, Empty, ListingCard, LoginLink, Notice, Price } from './ui'

export function Favorites() {
  const { user, ready } = useSession()
  if (!ready) return <main className="content-width"><Notice>Carregando…</Notice></main>
  return <main className="content-width inner-page"><div className="eyebrow">SUA BUSCA</div><h1>Favoritos</h1>
    {user ? <FavoriteResults key={user.uid} uid={user.uid} /> : <Empty title="Guarde os imóveis que você gostou"><LoginLink>Entrar para ver favoritos</LoginLink></Empty>}
  </main>
}
function FavoriteResults({ uid }: { uid: string }) {
  const [items, setItems] = useState<Listing[]>([])
  const [cursor, setCursor] = useState<Cursor>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function load(after?: Cursor) {
    setLoading(true)
    setError('')
    try {
      const page = await favoritePage(uid, after)
      const listings = await Promise.all(page.ids.map(async id => {
        try { return await getListing(id) }
        catch (err) {
          if ((err as { code?: string }).code === 'permission-denied') return null
          throw err
        }
      }))
      const visible = listings.filter((item): item is Listing => !!item && item.publication === 'published' && item.visibility !== 'hidden')
      setItems(previous => after ? [...previous, ...visible] : visible)
      setCursor(page.next)
    } catch (err) { setError(errorText(err)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [uid])
  return <>
    {loading && <Notice>Carregando favoritos…</Notice>}
    {error && <Notice error>{error} <button className="text-button" onClick={() => load()}>Tentar novamente</button></Notice>}
    {!loading && !error && items.length === 0 && <Empty title="Nenhum favorito disponível"><Link to="/">Explorar imóveis</Link></Empty>}
    <div className="favorites-grid">{items.map(item => <ListingCard key={item.id} item={item} onFavorite={value => {
      if (!value) setItems(p => p.filter(l => l.id !== item.id))
    }} />)}</div>
    {cursor && <button className="button light" disabled={loading} onClick={() => load(cursor)}>Carregar mais favoritos</button>}
  </>
}
export function Management() {
  const { user, ready } = useSession()
  if (!ready) return <main className="content-width"><Notice>Carregando…</Notice></main>
  return <main className="content-width inner-page">
    <div className="section-heading"><div><div className="eyebrow">ÁREA DO ANUNCIANTE</div><h1>Meus anúncios</h1></div>
      {user && <Link className="button primary" to="/meus-anuncios/novo"><Plus size={18} />Novo anúncio</Link>}</div>
    {user ? <OwnerResults key={user.uid} uid={user.uid} /> : <Empty title="Anuncie um imóvel"><LoginLink>Entrar para gerenciar anúncios</LoginLink></Empty>}
  </main>
}
function OwnerResults({ uid }: { uid: string }) {
  const location = useLocation()
  const [tab, setTab] = useState<Publication>(location.state?.tab || 'published')
  const [items, setItems] = useState<Listing[]>([])
  const [cursor, setCursor] = useState<Cursor>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  async function load(after?: Cursor) {
    setLoading(true)
    setError('')
    try {
      const page = await ownerPage(uid, after)
      setItems(p => after ? [...new Map([...p, ...page.items].map(item => [item.id, item])).values()] : page.items)
      setCursor(page.next)
    } catch (err) { setError(errorText(err)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [uid])
  async function change(item: Listing, next: Publication) {
    if (busy) return
    if (next === 'archived' && !window.confirm('Arquivar este anúncio e removê-lo da busca pública?')) return
    setBusy(item.id)
    setError('')
    try { await changePublication(item, next); await load(); setTab(next) }
    catch (err) { setError((err as { code?: string }).code ? errorText(err) : (err as Error).message) }
    finally { setBusy('') }
  }
  const visible = items.filter(item => item.publication === tab)
  return <>
    <div className="segments management-tabs" aria-label="Situação dos anúncios">{Object.entries(publications).map(([key, label]) =>
      <button key={key} aria-pressed={key === tab} className={key === tab ? 'active' : ''} onClick={() => setTab(key as Publication)}>{label}</button>)}</div>
    {loading && <Notice>Carregando anúncios…</Notice>}{error && <Notice error>{error} <button className="text-button" onClick={() => load()}>Atualizar lista</button></Notice>}
    {!loading && !error && !visible.length && <Empty title="Nenhum anúncio nesta seção">{cursor ? 'Carregue mais anúncios para consultar outras páginas.' : 'Crie um anúncio ou consulte as outras seções.'}</Empty>}
    <div className="owner-list">{visible.map(item => <article className="panel owner-item" key={item.id}>
      <div><Badge item={item} /><h2>{item.title || 'Rascunho sem título'}</h2><Price item={item} />
        <p className="muted">Atualizado em {item.updatedAt.toDate().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
        {overdue(item) && <Notice>Previsão vencida. Confirme ou atualize a disponibilidade.</Notice>}
        {item.publication === 'published' && item.visibility === 'hidden' && <p className="muted">Fora da busca pública pela disponibilidade escolhida.</p>}
      </div>
      <div className="owner-actions">
        <Link className="button light" to={'/meus-anuncios/' + item.id}>Editar</Link>
        <Link className="button light" to={'/meus-anuncios/' + item.id + '?etapa=5'}>Disponibilidade</Link>
        {item.publication === 'published' ? <>
          <Link className="button light" to={'/imovel/' + item.id}><ExternalLink size={16} />Ver anúncio</Link>
          <button className="button light" disabled={!!busy} onClick={() => change(item, 'paused')}><Pause size={16} />Pausar</button></> :
          <Link className="button primary" to={'/meus-anuncios/' + item.id + '?etapa=6'}>{item.publication === 'draft' ? 'Revisar e publicar' : 'Revisar e republicar'}</Link>}
        {item.publication !== 'archived' && <button className="button light" disabled={!!busy} onClick={() => change(item, 'archived')}><Archive size={16} />Arquivar</button>}
      </div>
    </article>)}</div>
    {cursor && <button className="button light" disabled={loading || !!busy} onClick={() => load(cursor)}>Carregar mais anúncios</button>}
    <Link className="text-button back" to="/"><ArrowLeft size={16} />Voltar para explorar</Link>
  </>
}

