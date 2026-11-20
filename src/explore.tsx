import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowDownUp, Building2, House, List, Map as MapIcon, Search, SlidersHorizontal } from 'lucide-react'
import { city, initialArea } from './config'
import { publicPage, type Cursor } from './data'
import { errorText, normalize, type Listing } from './domain'
import { Legend, PropertyMap } from './map'
import { Empty, ListingCard, Modal, Notice } from './ui'

const defaults = {
  text: '', purpose: '', kind: '', neighborhood: '', min: '', max: '', beds: '', parking: '',
  pets: false, furnished: false, availability: '', occupied: false, order: 'recent',
}
type Filters = typeof defaults
function match(item: Listing, f: Filters) {
  const term = normalize(f.text)
  return (!term || normalize(item.title + ' ' + item.neighborhood).includes(term)) &&
    (!f.purpose || item.purpose === f.purpose) && (!f.kind || item.kind === f.kind) &&
    (!f.neighborhood || normalize(item.neighborhood).includes(normalize(f.neighborhood))) &&
    (!f.min || item.price >= +f.min) && (!f.max || item.price <= +f.max) &&
    (!f.beds || item.beds >= +f.beds) && (!f.parking || item.parking >= +f.parking) &&
    (!f.pets || item.pets) && (!f.furnished || item.furnished) &&
    (!f.availability || item.availability === f.availability) && (f.occupied || item.availability !== 'occupied')
}
function FiltersDialog({ filters, apply, close }: { filters: Filters; apply: (f: Filters) => void; close: () => void }) {
  const [f, set] = useState(filters)
  const [error, setError] = useState('')
  function change<K extends keyof Filters>(key: K, value: Filters[K]) { set(p => ({ ...p, [key]: value })) }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (f.min && f.max && +f.min > +f.max) { setError('O preço máximo deve ser maior ou igual ao mínimo.'); return }
    apply(f)
  }
  return <Modal title="Filtrar imóveis" onClose={close}><form onSubmit={submit} className="form-grid">
    <label>Bairro<input value={f.neighborhood} onChange={e => change('neighborhood', e.target.value)} /></label>
    <label>Tipo de imóvel<select value={f.kind} onChange={e => change('kind', e.target.value)}><option value="">Todos</option><option value="house">Casa</option><option value="apartment">Apartamento</option></select></label>
    <label>Preço mínimo (R$)<input type="number" min="0" step="0.01" value={f.min} onChange={e => change('min', e.target.value)} /></label>
    <label>Preço máximo (R$)<input type="number" min="0" step="0.01" value={f.max} onChange={e => change('max', e.target.value)} />{error && <small className="inline-error">{error}</small>}</label>
    <label>Mínimo de quartos<input type="number" min="0" max="100" value={f.beds} onChange={e => change('beds', e.target.value)} /></label>
    <label>Mínimo de vagas<input type="number" min="0" max="100" value={f.parking} onChange={e => change('parking', e.target.value)} /></label>
    <label className="wide">Disponibilidade<select value={f.availability} onChange={e => change('availability', e.target.value)}><option value="">Qualquer disponibilidade</option><option value="available">Disponível agora</option><option value="soon">Em breve</option>{f.occupied && <option value="occupied">Ocupado</option>}</select></label>
    <label className="check"><input type="checkbox" checked={f.pets} onChange={e => change('pets', e.target.checked)} />Aceita pets</label>
    <label className="check"><input type="checkbox" checked={f.furnished} onChange={e => change('furnished', e.target.checked)} />Mobiliado</label>
    <label className="check wide"><input type="checkbox" checked={f.occupied} onChange={e => set(p => ({ ...p, occupied: e.target.checked, availability: p.availability === 'occupied' ? '' : p.availability }))} />Mostrar ocupados</label>
    <div className="wide action-row"><button type="button" className="button light" onClick={() => { set(defaults); setError('') }}>Limpar filtros</button><button className="button primary">Aplicar filtros</button></div>
  </form></Modal>
}
export function Explore() {
  const [filters, setFilters] = useState(defaults)
  const [area, setArea] = useState(initialArea)
  const [items, setItems] = useState<Listing[]>([])
  const [cursor, setCursor] = useState<Cursor>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string>()
  const [view, setView] = useState<'map' | 'list'>('map')

  useEffect(() => {
    let current = true
    setLoading(true)
    setLoadingMore(false)
    setError('')
    setItems([])
    setCursor(undefined)
    publicPage(area, filters.occupied).then(result => {
      if (!current) return
      setItems(result.items)
      setCursor(result.next)
    }).catch(err => { if (current) setError(errorText(err)) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [area, filters.occupied, refresh])

  const results = useMemo(() => items.filter(item => match(item, filters)).sort((a, b) => {
    if (filters.order === 'asc') return a.price - b.price
    if (filters.order === 'desc') return b.price - a.price
    return b.createdAt.toMillis() - a.createdAt.toMillis()
  }), [items, filters])
  const selected = results.find(item => item.id === selectedId)
  const count = Object.entries(filters).filter(([key, value]) => !['text', 'purpose', 'order'].includes(key) && value).length

  async function more() {
    if (!cursor || loading || loadingMore) return
    setLoadingMore(true)
    setError('')
    try {
      const result = await publicPage(area, filters.occupied, cursor)
      setItems(previous => [...new Map([...previous, ...result.items].map(item => [item.id, item])).values()])
      setCursor(result.next)
    } catch (err) { setError(errorText(err)) }
    finally { setLoadingMore(false) }
  }
  function searchHere(next: typeof initialArea) {
    if (loadingMore) return
    setSelectedId(undefined)
    setArea(next)
  }
  return <main className="explore page-width">
    <section className="explore-hero">
      <div className="eyebrow"><span className="live-dot" /> {city.name.toUpperCase()} · {city.state}</div>
      <h1>Encontre seu próximo <em>lar.</em></h1>
      <p>Explore casas e apartamentos para alugar ou comprar na cidade.</p>
    </section>
    <div className="search-toolbar">
      <label className="search-field"><Search size={20} /><input aria-label="Buscar por bairro ou título" placeholder="Buscar por bairro ou título" value={filters.text}
        onChange={e => setFilters({ ...filters, text: e.target.value })} /></label>
      <div className="segments" aria-label="Finalidade">{[
        { key: '', label: 'Todos' }, { key: 'rent', label: 'Alugar', icon: House }, { key: 'sale', label: 'Comprar', icon: Building2 },
      ].map(({ key, label, icon: Icon }) => <button key={key} className={filters.purpose === key ? 'active' : ''} aria-pressed={filters.purpose === key}
        onClick={() => setFilters({ ...filters, purpose: key })}>{Icon && <Icon size={16} />}{label}</button>)}</div>
      <button className="button light filter-button" onClick={() => setFilterOpen(true)} disabled={loadingMore}><SlidersHorizontal size={18} />Filtros{count > 0 && <span className="filter-count">{count}</span>}</button>
    </div>
    <div className="mobile-views segments" aria-label="Visualização">
      <button className={view === 'map' ? 'active' : ''} aria-pressed={view === 'map'} onClick={() => setView('map')}><MapIcon size={17} />Mapa</button>
      <button className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={17} />Lista</button>
    </div>
    <div className={'explore-layout view-' + view}>
      <section className="results" aria-label="Resultados da busca">
        <div className="results-header">
          <div><div className="eyebrow">RESULTADOS NA ÁREA</div><h2>{loading ? 'Buscando…' : results.length + (results.length === 1 ? ' imóvel' : ' imóveis')}</h2></div>
          <label className="sort-field"><ArrowDownUp size={15} /><select aria-label="Ordenar resultados" value={filters.order} onChange={e => setFilters({ ...filters, order: e.target.value })}>
            <option value="recent">Mais recentes</option><option value="asc">Menor preço</option><option value="desc">Maior preço</option>
          </select></label>
        </div>
        {error && <Notice error>{error} <button className="text-button" onClick={() => setRefresh(v => v + 1)}>Recarregar</button></Notice>}
        {!loading && !error && results.length === 0 && <Empty title="Nenhum imóvel nesta busca">Ajuste os filtros ou busque em outra área. {cursor && 'Há mais páginas para consultar.'}
          <button className="text-button" disabled={loadingMore} onClick={() => setFilters(defaults)}>Limpar filtros</button></Empty>}
        <div className="result-cards">{results.map(item => <ListingCard key={item.id} item={item} active={selectedId === item.id}
          onSelect={() => { setSelectedId(item.id); setView('map') }} />)}</div>
        {cursor && <button className="button light full" disabled={loadingMore} onClick={more}>{loadingMore ? 'Carregando…' : 'Carregar mais imóveis da área'}</button>}
      </section>
      <section className="map-column" aria-label="Resultados no mapa">
        <Legend />
        <PropertyMap items={results} selected={selected} onSelect={item => setSelectedId(item?.id)} onArea={searchHere} />
        <div className="map-caption"><span>Os marcadores indicam regiões aproximadas.</span><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Reportar problema no mapa</a></div>
        {error && <Notice error>{error} <button className="text-button" onClick={() => setRefresh(v => v + 1)}>Recarregar</button></Notice>}
        {loading && <p className="muted" role="status">Buscando imóveis…</p>}
        {!loading && !error && <p className="map-result-count" role="status">{results.length} {results.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'} na área.</p>}
        {cursor && <button className="button light mobile-map-more" disabled={loadingMore} onClick={more}>{loadingMore ? 'Carregando…' : 'Carregar mais imóveis da área'}</button>}
      </section>
    </div>
    {filterOpen && <FiltersDialog filters={filters} close={() => setFilterOpen(false)} apply={f => { setFilters(f); setFilterOpen(false) }} />}
  </main>
}

