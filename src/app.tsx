import { useEffect, useState } from 'react'
import { Compass, Heart, LayoutList, MapPin, Plus, UserRound } from 'lucide-react'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { localMode } from './firebase'
import { Detail } from './detail'
import { Editor } from './editor'
import { Explore } from './explore'
import { Favorites, Management } from './management'
import { Profile } from './profile'
import { SessionProvider } from './session'
import { Empty, Notice } from './ui'

const nav = [
  { to: '/', label: 'Explorar', icon: Compass },
  { to: '/favoritos', label: 'Favoritos', icon: Heart },
  { to: '/meus-anuncios', label: 'Meus anúncios', icon: LayoutList },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
]
function Header() {
  return <header className="site-header"><div className="header-inner page-width">
    <Link className="brand" to="/" aria-label="Aluguel Map, início"><span className="brand-icon"><MapPin size={24} strokeWidth={2.5} /></span><span>Aluguel<span className="brand-accent">Map</span></span></Link>
    <nav aria-label="Navegação principal">{nav.map(({ to, label, icon: Icon }) =>
      <NavLink key={to} to={to} end={to === '/'}><Icon size={18} aria-hidden="true" />{label}</NavLink>)}</nav>
    <Link to="/meus-anuncios/novo" className="button primary header-cta"><Plus size={18} aria-hidden="true" /><span>Anunciar imóvel</span></Link>
  </div></header>
}
function Legal({ terms }: { terms?: boolean }) {
  return <main className="content-width inner-page legal-page">
    <div className="eyebrow">RASCUNHO PARA REVISÃO</div><h1>{terms ? 'Termos de uso' : 'Privacidade'}</h1>
    {terms ? <><h2>Busca e publicação</h2><p>O Aluguel Map aproxima quem procura imóveis e quem anuncia. Cada anunciante é responsável pelas informações publicadas, pela autorização de contato e pela atualização da disponibilidade.</p>
      <h2>Contato e denúncias</h2><p>As conversas acontecem no WhatsApp. Use o botão de denúncia para sinalizar anúncios com informações incorretas, conteúdo impróprio ou suspeita de fraude.</p></> :
      <><h2>Conta e atividade</h2><p>Usamos nome, e-mail e identificador da conta para permitir autenticação, favoritos, gestão de anúncios e denúncias. Favoritos e perfil ficam associados à sua conta. As denúncias são privadas.</p>
      <h2>Localização e contato</h2><p>O mapa exibe a região aproximada escolhida pelo anunciante. A localização fornecida pelo navegador só é usada para mover o mapa. O WhatsApp fica separado do anúncio e só é compartilhado com contas verificadas se o anunciante autorizar a divulgação.</p>
      <h2>Serviços externos</h2><p>O navegador consulta o provedor de mapas para exibir os tiles. Ao abrir o WhatsApp, você passa a usar o serviço externo.</p></>}
  </main>
}
function Shell() {
  const location = useLocation()
  const atExplore = location.pathname === '/'
  const [explored, setExplored] = useState(atExplore)
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => { if (atExplore) setExplored(true) }, [atExplore])
  useEffect(() => {
    function connectivity() { setOffline(!navigator.onLine) }
    window.addEventListener('online', connectivity)
    window.addEventListener('offline', connectivity)
    return () => { window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity) }
  }, [])
  useEffect(() => { if (!atExplore) window.scrollTo(0, 0) }, [location.pathname, atExplore])
  const keepExplore = atExplore || (explored && location.pathname.startsWith('/imovel/'))
  return <>
    <Header />
    {offline && <div className="page-width connection"><Notice>Você está offline. A lista pode mostrar resultados já carregados. Alterações exigem conexão.</Notice></div>}
    {keepExplore && <div hidden={!atExplore}><Explore /></div>}
    <Routes>
      <Route path="/" element={null} />
      <Route path="/imovel/:id" element={<Detail key={location.pathname} />} />
      <Route path="/favoritos" element={<Favorites />} />
      <Route path="/meus-anuncios" element={<Management />} />
      <Route path="/meus-anuncios/novo" element={<Editor key="new" />} />
      <Route path="/meus-anuncios/:id" element={<Editor key={location.pathname + location.search} />} />
      <Route path="/perfil" element={<Profile />} />
      <Route path="/privacidade" element={<Legal />} />
      <Route path="/termos" element={<Legal terms />} />
      <Route path="*" element={<main className="content-width inner-page"><Empty title="Página indisponível"><Link to="/">Voltar para explorar</Link></Empty></main>} />
    </Routes>
    <footer className="site-footer page-width"><span>{localMode ? 'Demonstração local · imóveis fictícios' : 'Aluguel Map'}</span><div><Link to="/privacidade">Privacidade</Link><Link to="/termos">Termos de uso</Link></div></footer>
  </>
}
export function App() {
  return <BrowserRouter><SessionProvider><Shell /></SessionProvider></BrowserRouter>
}
