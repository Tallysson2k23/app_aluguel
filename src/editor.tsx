import { cloneElement, useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from 'react'
import { ArrowLeft, ArrowRight, Check, MapPin } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { city, gridScale } from './config'
import { getContact, getListing, newListingId, saveListing } from './data'
import { availabilities, errorText, features, kindLabel, overdue, position, whatsapp, type Draft, type Listing, type Publication } from './domain'
import { PropertyMap } from './map'
import { useSession } from './session'
import { Badge, LoginLink, Notice, Photo, Price, Specs } from './ui'

const steps = ['Imóvel', 'Valores e medidas', 'Características', 'Localização', 'Disponibilidade', 'Prévia']
const initial: Draft = {
  city: city.id, purpose: 'rent', kind: 'house', availability: 'available', title: '', description: '', neighborhood: '',
  latCell: Math.round(city.center[0] * gridScale), lngCell: Math.round(city.center[1] * gridScale),
  price: 0, condo: null, tax: null, fees: null, size: 0, beds: 0, baths: 0, parking: 0,
  pets: false, furnished: false, garage: false, accessible: false, availableOn: null, showOccupied: false, contactEnabled: false,
}
type Errors = Partial<Record<keyof Draft | 'phone' | 'confirmed', string>>
function validate(data: Draft, phone: string, forPublication: boolean): Errors {
  const errors: Errors = {}
  if (forPublication && data.title.trim().length < 5) errors.title = 'Informe pelo menos 5 caracteres.'
  if (forPublication && data.description.trim().length < 15) errors.description = 'Descreva o imóvel em pelo menos 15 caracteres.'
  if (forPublication && data.neighborhood.trim().length < 2) errors.neighborhood = 'Informe o bairro.'
  const amountKeys = ['price', 'condo', 'tax', 'fees', 'size', 'beds', 'baths', 'parking'] as const
  for (const key of amountKeys) {
    const value = data[key]
    if (value === null) continue
    const whole = key === 'beds' || key === 'baths' || key === 'parking'
    const max = whole ? 100 : key === 'size' ? 100000 : 100000000
    if (!Number.isFinite(value) || value < 0 || value > max || (whole && !Number.isInteger(value))) {
      errors[key] = 'Informe um valor válido entre 0 e ' + max.toLocaleString('pt-BR') + '.'
    }
  }
  if (forPublication && data.price <= 0) errors.price = 'Informe um preço maior que zero.'
  if (forPublication && data.size <= 0) errors.size = 'Informe uma área maior que zero.'
  if ((data.contactEnabled || phone.trim()) && !whatsapp(phone.trim())) errors.phone = 'Informe um WhatsApp brasileiro válido com DDD.'
  if (data.availableOn) {
    const parsed = new Date(data.availableOn + 'T12:00:00Z')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.availableOn) || !Number.isFinite(+parsed)
      || parsed.toISOString().slice(0, 10) !== data.availableOn) errors.availableOn = 'Informe uma data válida.'
  }
  return errors
}
const fieldSteps: Partial<Record<keyof Errors, number>> = {
  title: 0, description: 0, price: 1, size: 1, condo: 1, tax: 1, fees: 1, beds: 1, baths: 1, parking: 1,
  neighborhood: 3, phone: 4, availableOn: 4, confirmed: 4,
}
function Field({ label, children, error }: {
  label: string; children: ReactElement<{ id?: string; 'aria-describedby'?: string }>; error?: string
}) {
  const id = useId()
  return <div className="field"><label htmlFor={id}>{label}</label>
    {cloneElement(children, { id, 'aria-describedby': error ? id + '-error' : undefined })}
    {error && <small id={id + '-error'} className="inline-error" role="alert">{error}</small>}</div>
}

export function Editor() {
  const { id } = useParams()
  const { user, ready } = useSession()
  const [loaded, setLoaded] = useState<{ item: Listing; phone: string } | null>()
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    let current = true
    setLoaded(undefined)
    setLoadError('')
    if (id && user) {
      void (async () => {
        try {
          const item = await getListing(id)
          if (!item || item.ownerId !== user.uid) { if (current) setLoaded(null); return }
          const phone = await getContact(id)
          if (current) setLoaded({ item, phone: phone || '' })
        } catch (err) { if (current) setLoadError(errorText(err)) }
      })()
    }
    return () => { current = false }
  }, [id, user?.uid])
  if (!ready) return <main className="content-width"><Notice>Carregando…</Notice></main>
  if (!user) return <main className="content-width inner-page"><Notice>Entre para cadastrar e gerenciar seus imóveis.</Notice><LoginLink>Entrar na conta</LoginLink></main>
  if (loadError || (id && loaded === null)) return <main className="content-width inner-page"><Notice error>{loadError || 'Anúncio indisponível para edição.'}</Notice><Link to="/meus-anuncios">Voltar aos meus anúncios</Link></main>
  if (id && !loaded) return <main className="content-width"><Notice>Carregando anúncio…</Notice></main>
  return <ListingForm key={user.uid + ':' + (id || 'new')} uid={user.uid} verified={user.emailVerified} item={loaded?.item} previousPhone={loaded?.phone || ''} />
}

function ListingForm({ uid, verified, item, previousPhone }: { uid: string; verified: boolean; item?: Listing; previousPhone: string }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const quick = !!item && params.get('etapa') === '5'
  const [step, setStep] = useState(item && params.get('etapa') === '6' ? 5 : quick ? 4 : 0)
  const [data, setData] = useState<Draft>(() => {
    if (!item) return initial
    const { id, ownerId, publication, visibility, createdAt, updatedAt, ...rest } = item
    return rest
  })
  const [phone, setPhone] = useState(previousPhone)
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const writing = useRef(false)
  const mounted = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const [listingId] = useState(() => item?.id || newListingId())
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setData(p => ({ ...p, [key]: value }))
    setErrors(p => ({ ...p, [key]: undefined }))
  }
  function go(next: number) {
    setStep(next)
    requestAnimationFrame(() => heading.current?.focus())
  }
  function validateStep(e: FormEvent) {
    e.preventDefault()
    const result = validate(data, phone, true)
    const current = Object.fromEntries(Object.entries(result).filter(([key]) => fieldSteps[key as keyof Errors] === step))
    setErrors(current)
    if (!Object.keys(current).length) go(step + 1)
  }
  async function persist(publication: Publication) {
    if (writing.current) return
    setError('')
    const issues = validate(data, phone, publication === 'published')
    if (publication === 'published' && overdue(data) && !confirmed) issues.confirmed = 'Confirme a previsão vencida ou atualize a data.'
    const first = Object.keys(issues).map(key => fieldSteps[key as keyof Errors] ?? 0).sort()[0]
    if (first !== undefined) { setErrors(issues); go(first); return }
    if (publication === 'published' && !verified) { setError('Verifique seu e-mail no Perfil antes de publicar. Você pode salvar um rascunho.'); return }
    writing.current = true
    setBusy(true)
    const number = phone.trim() ? whatsapp(phone.trim()) : previousPhone ? '' : null
    try {
      await saveListing(listingId, uid, {
        ...data, title: data.title.trim(), description: data.description.trim(), neighborhood: data.neighborhood.trim(),
      }, publication, number, item?.updatedAt)
      if (mounted.current) navigate('/meus-anuncios', { replace: true, state: { tab: publication } })
    } catch (err) {
      setError((err as { code?: string }).code ? errorText(err) : (err as Error).message)
    } finally { writing.current = false; setBusy(false) }
  }
  function numeric(key: 'price' | 'size' | 'condo' | 'tax' | 'fees' | 'beds' | 'baths' | 'parking', label: string, stepSize: string, optional = false) {
    const value = data[key]
    return <Field label={label} error={errors[key]}><input type="number" inputMode={stepSize === '1' ? 'numeric' : 'decimal'} step={stepSize} min={0}
      placeholder={optional ? 'Não informado' : undefined} aria-invalid={!!errors[key]} value={value ?? ''}
      onChange={e => change(key, e.target.value === '' ? optional ? null : 0 : e.target.valueAsNumber)} /></Field>
  }
  function setPoint(point: [number, number]) {
    setData(p => ({ ...p, latCell: Math.round(point[0] * gridScale), lngCell: Math.round(point[1] * gridScale) }))
  }
  function setAvailability(availability: Draft['availability']) {
    setConfirmed(false)
    setData(p => ({ ...p, availability, availableOn: availability === 'soon' ? p.availableOn : null,
      showOccupied: availability === 'occupied' && p.showOccupied,
      contactEnabled: (availability === 'available' || availability === 'soon') && p.contactEnabled }))
  }
  return <main className="content-width inner-page editor-page">
    <Link className="text-button back" to="/meus-anuncios"><ArrowLeft size={17} />Meus anúncios</Link>
    <div className="eyebrow">ÁREA DO ANUNCIANTE</div><h1>{item ? 'Editar anúncio' : 'Novo anúncio'}</h1>
    <ol className="steps" aria-label="Etapas do anúncio">{steps.map((label, i) => <li key={label} aria-current={i === step ? 'step' : undefined}>
      <span>{i < step ? <Check size={14} /> : i + 1}</span><b>{label}</b></li>)}</ol>
    <section className="panel editor-panel">
      <div className="eyebrow">ETAPA {step + 1} DE {steps.length}</div><h2 ref={heading} tabIndex={-1}>{steps[step]}</h2>
      {error && <Notice error>{error}</Notice>}
      <form noValidate onSubmit={step === 5 ? e => { e.preventDefault(); void persist('published') } : validateStep} className="stack">
        <fieldset disabled={busy} className="form-grid">
          {step === 0 && <>
            <Field label="Finalidade"><select value={data.purpose} onChange={e => setData(p => ({
              ...p, purpose: e.target.value as Draft['purpose'], availability: 'available', availableOn: null, showOccupied: false,
            }))}><option value="rent">Aluguel</option><option value="sale">Venda</option></select></Field>
            <Field label="Tipo de imóvel"><select value={data.kind} onChange={e => change('kind', e.target.value as Draft['kind'])}><option value="house">Casa</option><option value="apartment">Apartamento</option></select></Field>
            <div className="wide"><Field label="Título" error={errors.title}><input maxLength={90} aria-invalid={!!errors.title} value={data.title} onChange={e => change('title', e.target.value)} placeholder="Ex.: Casa térrea com garagem" /></Field></div>
            <div className="wide"><Field label="Descrição" error={errors.description}><textarea maxLength={3000} rows={5} aria-invalid={!!errors.description} value={data.description}
              onChange={e => change('description', e.target.value)} placeholder="Conte como é o imóvel. Evite informar endereço, telefone ou dados pessoais." /></Field></div>
          </>}
          {step === 1 && <>
            {numeric('price', data.purpose === 'rent' ? 'Aluguel mensal (R$)' : 'Preço de venda (R$)', '0.01')}
            {numeric('size', 'Área (m²)', '0.01')}
            {numeric('condo', 'Condomínio (R$)', '0.01', true)}
            {numeric('tax', 'IPTU (R$)', '0.01', true)}
            {numeric('fees', 'Outras taxas (R$)', '0.01', true)}
            {numeric('beds', 'Quartos', '1')}
            {numeric('baths', 'Banheiros', '1')}
            {numeric('parking', 'Vagas', '1')}
          </>}
          {step === 2 && Object.entries(features).map(([key, label]) => <label className="check" key={key}>
            <input type="checkbox" checked={data[key as keyof typeof features]} onChange={e => change(key as keyof typeof features, e.target.checked)} />{label}</label>)}
          {step === 3 && <>
            <div className="wide"><Field label="Bairro" error={errors.neighborhood}><input maxLength={70} value={data.neighborhood} aria-invalid={!!errors.neighborhood}
              onChange={e => change('neighborhood', e.target.value)} /></Field></div>
            <div className="wide"><p className="muted"><MapPin size={16} /> Selecione um ponto aproximado na região do imóvel. Evite indicar a residência.</p>
              <PropertyMap point={position(data)} onPoint={setPoint} small />
              <div className="action-row point-controls" aria-label="Ajustar marcador aproximado">
                {([['Norte', 1, 0], ['Sul', -1, 0], ['Leste', 0, 1], ['Oeste', 0, -1]] as const).map(([name, y, x]) =>
                  <button key={name} className="button light" type="button" onClick={() => setPoint([(data.latCell + y) / gridScale, (data.lngCell + x) / gridScale])}>{name}</button>)}
              </div>
              <p className="muted" aria-live="polite">Marcador aproximado em {position(data).map(n => n.toFixed(3)).join(', ')}.</p></div>
          </>}
          {step === 4 && <>
            <Field label="Disponibilidade"><select value={data.availability} onChange={e => setAvailability(e.target.value as Draft['availability'])}>
              {(data.purpose === 'rent' ? ['available', 'soon', 'occupied'] : ['available', 'closed']).map(key => <option key={key} value={key}>{availabilities[key as Draft['availability']]}</option>)}</select></Field>
            {data.availability === 'soon' && <Field label="Previsão (opcional)" error={errors.availableOn}><input type="date" value={data.availableOn || ''}
              onChange={e => { setConfirmed(false); change('availableOn', e.target.value || null) }} /></Field>}
            {overdue(data) && <div className="wide"><Notice>A data prevista já passou. O anúncio só muda quando você editar a disponibilidade.</Notice>
              <label className="check"><input type="checkbox" checked={confirmed} onChange={e => { setConfirmed(e.target.checked); setErrors(p => ({ ...p, confirmed: undefined })) }} />Confirmo que o imóvel continua previsto para breve.</label>
              {errors.confirmed && <small role="alert" className="inline-error">{errors.confirmed}</small>}</div>}
            {data.availability === 'occupied' && <label className="check wide"><input type="checkbox" checked={data.showOccupied} onChange={e => change('showOccupied', e.target.checked)} />
              Autorizo mostrar este imóvel ocupado no filtro específico, com localização aproximada.</label>}
            <div className="wide"><Field label="WhatsApp com DDD (opcional)" error={errors.phone}><input type="tel" autoComplete="tel" maxLength={24} value={phone} aria-invalid={!!errors.phone}
              onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: undefined })); if (!e.target.value.trim()) change('contactEnabled', false) }} placeholder="(81) 99999-9999" /></Field></div>
            {(data.availability === 'available' || data.availability === 'soon') && <label className="check wide"><input type="checkbox" checked={data.contactEnabled}
              onChange={e => change('contactEnabled', e.target.checked)} />Autorizo exibir meu WhatsApp a interessados com conta e e-mail verificado.</label>}
          </>}
          {step === 5 && <div className="wide listing-card form-preview">
            <Photo item={data} /><div className="card-body"><Badge item={data} /><h3>{data.title || 'Sem título'}</h3>
              <p className="muted">{kindLabel[data.kind]} · {data.neighborhood || 'Bairro não informado'}</p><Price item={data} /><Specs item={data} /><p className="description">{data.description}</p></div>
          </div>}
        </fieldset>
        {step === 5 && !verified && <Notice>Verifique seu e-mail no <Link to="/perfil">Perfil</Link> para publicar. Você pode salvar o preenchimento como rascunho.</Notice>}
        <div className="editor-actions">
          {step > 0 && <button type="button" className="button light" disabled={busy} onClick={() => go(step - 1)}><ArrowLeft size={16} />Anterior</button>}
          {item?.publication !== 'published' && <button type="button" className="button light" disabled={busy}
            onClick={() => persist(item?.publication || 'draft')}>{item?.publication === 'paused' || item?.publication === 'archived' ? 'Salvar alterações' : 'Salvar rascunho'}</button>}
          {step < 5 ? quick && step === 4 ? <button type="button" className="button primary" disabled={busy} onClick={() => persist(item?.publication || 'draft')}>Salvar disponibilidade</button>
            : <button className="button primary" disabled={busy}>Continuar <ArrowRight size={17} /></button> :
            <button className="button primary" disabled={busy || !verified}>{busy ? 'Salvando…' : item?.publication === 'published' ? 'Salvar alterações' : 'Publicar anúncio'} <Check size={17} /></button>}
        </div>
      </form>
    </section>
  </main>
}
