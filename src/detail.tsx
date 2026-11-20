import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Flag, MapPin, MessageCircle, Share2 } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { city } from './config'
import { getContact, reportListing, reportReasons, watchListing } from './data'
import { errorText, features, kindLabel, money, position, type Listing } from './domain'
import { PropertyMap } from './map'
import { useSession } from './session'
import { Badge, Empty, Favorite, LoginLink, Modal, Notice, Photo, Price, Specs } from './ui'

export function Detail() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, ready } = useSession()
  const [item, setItem] = useState<Listing | null>()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [phone, setPhone] = useState('')
  const [contactBusy, setContactBusy] = useState(false)
  const [share, setShare] = useState(false)
  const [report, setReport] = useState(false)
  const [reason, setReason] = useState(reportReasons[0])
  const [reportBusy, setReportBusy] = useState(false)
  useEffect(() => {
    if (!ready) return
    return watchListing(id, setItem, () => setItem(null))
  }, [id, ready, user?.uid])
  const contactVisible = item?.publication === 'published' && item.contactEnabled && item.visibility === 'normal'
  useEffect(() => { setPhone('') }, [id, user?.uid, user?.emailVerified, contactVisible, item?.updatedAt])

  async function revealContact() {
    setContactBusy(true)
    setError('')
    try {
      const value = await getContact(id)
      if (!value) setError('O anunciante ainda não disponibilizou um número.')
      else setPhone(value)
    } catch (err) { setError(errorText(err)) }
    finally { setContactBusy(false) }
  }
  async function shareListing() {
    setMessage('')
    if (navigator.share) {
      try { await navigator.share({ title: item?.title, url: window.location.href }); return }
      catch (err) { if ((err as Error).name === 'AbortError') return }
    }
    setShare(true)
  }
  async function sendReport(e: FormEvent) {
    e.preventDefault()
    if (!user || reportBusy) return
    setReportBusy(true)
    setError('')
    try {
      await reportListing(user.uid, id, reason)
      setReport(false)
      setMessage('Denúncia registrada.')
    } catch (err) {
      setError((err as { code?: string }).code === 'permission-denied'
        ? 'A denúncia já foi enviada por esta conta ou o anúncio saiu do ar.' : errorText(err))
    } finally { setReportBusy(false) }
  }
  const goBack = () => location.state?.fromExplore ? navigate(-1) : navigate('/')
  if (item === undefined) return <main className="content-width"><Notice>Carregando imóvel…</Notice></main>
  if (!item) return <main className="content-width"><Empty title="Imóvel indisponível">Este anúncio pode ter saído do ar. <Link to="/">Voltar para explorar</Link></Empty></main>
  const publicItem = item.publication === 'published' && item.visibility !== 'hidden'
  const shareUrl = window.location.href
  return <main className="content-width detail-page">
    <button className="text-button back" onClick={goBack}><ArrowLeft size={17} />Voltar para explorar</button>
    {!publicItem && <Notice>Visualização privada do anunciante.</Notice>}
    {message && <Notice>{message}</Notice>}
    {error && !report && <Notice error>{error}</Notice>}
    <div className="detail-layout">
      <div className="detail-main">
        <Photo item={item} />
        <section className="panel detail-info">
          <div className="card-meta"><Badge item={item} /><span>{kindLabel[item.kind]}</span></div>
          <h1>{item.title || 'Rascunho sem título'}</h1>
          <p className="muted location"><MapPin size={16} />{item.neighborhood}, {city.name} – {city.state}</p>
          <Specs item={item} />
          <h2>Sobre o imóvel</h2><p className="description">{item.description || 'Descrição ainda não informada.'}</p>
          <div className="feature-list">{Object.entries(features).filter(([key]) => item[key as keyof typeof features]).map(([key, label]) => <span key={key}>{label}</span>)}</div>
          <h2>Localização aproximada</h2><p className="muted">O mapa mostra a região indicada pelo anunciante.</p>
          <PropertyMap key={item.latCell + ':' + item.lngCell} point={position(item)} small />
          <p className="muted">Atualizado em {item.updatedAt?.toDate().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) || 'instantes'}</p>
        </section>
      </div>
      <aside className="panel detail-side">
        <div className="eyebrow">{item.purpose === 'rent' ? 'ALUGUEL MENSAL' : 'VALOR DE VENDA'}</div>
        <Price item={item} />
        <dl className="costs">{[['Condomínio', item.condo], ['IPTU', item.tax], ['Outras taxas', item.fees]].map(([label, value]) =>
          <div key={label}><dt>{label}</dt><dd>{typeof value === 'number' ? money(value) : 'Não informado'}</dd></div>)}</dl>
        {contactVisible && (user?.emailVerified ?
          (phone ? <a className="button primary full" href={'https://wa.me/' + phone + '?text=' + encodeURIComponent('Olá! Tenho interesse no imóvel “' + item.title + '” que encontrei no Aluguel Map. ' + shareUrl)} target="_blank" rel="noreferrer"><MessageCircle size={18} />Abrir WhatsApp</a>
            : <button className="button primary full" disabled={contactBusy} onClick={revealContact}><MessageCircle size={18} />{contactBusy ? 'Consultando…' : item.availability === 'soon' ? 'Tenho interesse' : 'Contato via WhatsApp'}</button>)
          : <LoginLink className="button primary full">{user ? 'Verificar e-mail para ver contato' : 'Entrar para ver contato'}</LoginLink>)}
        {publicItem && <div className="action-row detail-actions"><Favorite id={id} />
          <button className="button light" onClick={shareListing}><Share2 size={17} />Compartilhar</button>
          {user ? <button className="text-button" onClick={() => { setError(''); setReport(true) }}><Flag size={17} />Denunciar</button> : <LoginLink className="text-button">Entrar para denunciar</LoginLink>}</div>}
      </aside>
    </div>
    {share && <Modal title="Compartilhar imóvel" onClose={() => setShare(false)}>
      <label>Link direto<input readOnly value={shareUrl} onFocus={e => e.target.select()} /></label>
      <button className="button primary full" onClick={async () => {
        try { await navigator.clipboard.writeText(shareUrl); setShare(false); setMessage('Link copiado.') }
        catch { setMessage('Selecione o link para copiá-lo manualmente.') }
      }}>Copiar link</button>{message && <Notice>{message}</Notice>}
    </Modal>}
    {report && <Modal title="Denunciar anúncio" onClose={() => { if (!reportBusy) setReport(false) }}>
      <form className="stack" onSubmit={sendReport}><label>Motivo<select value={reason} onChange={e => setReason(e.target.value)}>{reportReasons.map(r => <option key={r}>{r}</option>)}</select></label>
        {error && <Notice error>{error}</Notice>}<button className="button primary" disabled={reportBusy}>Enviar denúncia</button></form>
    </Modal>}
  </main>
}
