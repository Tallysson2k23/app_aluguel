import { useState, type FormEvent } from 'react'
import { sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { ArrowRight, CheckCircle2, Mail, MapPin, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { auth, localMode } from './firebase'
import { errorText } from './domain'
import { register, useSession } from './session'
import { Notice } from './ui'

export function Profile() {
  const { user, ready, refresh } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const next = location.state?.next as string | undefined
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function action(work: () => Promise<void>) {
    if (busy) return
    setError('')
    setMessage('')
    setBusy(true)
    try { await work() } catch (err) { setError(errorText(err)) } finally { setBusy(false) }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    void action(async () => {
      if (mode === 'signup') {
        if (name.trim().length < 2) { setError('Informe seu nome.'); return }
        await register(name.trim(), email.trim(), password)
        await refresh()
        setMessage('Conta criada. Enviamos um link de verificação para o seu e-mail.')
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim())
        setMessage('Se houver uma conta para este endereço, você receberá um link para redefinir a senha.')
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
        if (next) navigate(next, { replace: true })
      }
    })
  }
  const changeMode = (value: typeof mode) => { setMode(value); setError(''); setMessage(''); setPassword('') }
  const titles = { login: 'Entre na sua conta', signup: 'Crie sua conta', reset: 'Recupere sua senha' }
  if (!ready) return <main className="content-width"><Notice>Carregando perfil…</Notice></main>
  return <main className="content-width account-page">
    <section className="account-card panel">
      <div className="account-icon">{user ? <UserRound /> : <MapPin />}</div><div className="eyebrow">SUA CONTA</div>
      <h1>{user ? 'Meu perfil' : titles[mode]}</h1>
      {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
      {user ? <>
        <h2>{user.displayName || 'Minha conta'}</h2><p className="muted">{user.email}</p>
        {user.emailVerified ? <Notice><CheckCircle2 size={18} /> E-mail verificado</Notice> : <>
          <Notice><Mail size={18} /> Verifique seu e-mail para publicar e acessar contatos autorizados.</Notice>
          {localMode && <p className="muted">Na demonstração, abra o link de verificação exibido no terminal do emulador.</p>}
          <div className="action-row"><button className="button light" disabled={busy} onClick={() => action(async () => { await sendEmailVerification(user); setMessage('Link de verificação enviado.') })}>Reenviar verificação</button>
          <button className="button primary" disabled={busy} onClick={() => action(async () => { await refresh(); setMessage(user.emailVerified ? 'E-mail verificado.' : 'Abra o link recebido e tente novamente.') })}>Já verifiquei</button></div>
        </>}
        <div className="account-links"><Link to={next || '/meus-anuncios'} className="button light">{next ? 'Voltar à página anterior' : 'Meus anúncios'} <ArrowRight size={16} /></Link>
          <button className="button light" disabled={busy} onClick={() => action(async () => { await signOut(auth); navigate('/') })}>Sair da conta</button></div>
      </> : <>
        <p className="muted">Salve imóveis e gerencie seus anúncios com a mesma conta.</p>
        <form className="stack" onSubmit={submit}>
          {mode === 'signup' && <label>Nome<input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>}
          <label>E-mail<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          {mode !== 'reset' && <label>Senha<input required type="password" minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>}
          <button className="button primary full" disabled={busy}>{busy ? 'Aguarde…' : mode === 'signup' ? 'Criar conta' : mode === 'reset' ? 'Enviar link de recuperação' : 'Entrar'}</button>
        </form>
        <div className="account-links">
          {mode === 'login' ? <><button className="text-button" onClick={() => changeMode('signup')}>Criar uma conta</button><button className="text-button" onClick={() => changeMode('reset')}>Esqueci minha senha</button></> :
            <button className="text-button" onClick={() => changeMode('login')}>Voltar para entrar</button>}
        </div>
      </>}
    </section>
  </main>
}
