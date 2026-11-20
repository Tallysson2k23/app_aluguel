import { createRoot } from 'react-dom/client'
import './style.css'

const root = createRoot(document.getElementById('root')!)
import('./app').then(({ App }) => root.render(<App />)).catch(error => {
  console.error(error)
  root.render(<main className="content-width inner-page"><h1>Aluguel Map</h1><p role="alert">Não foi possível iniciar o aplicativo. Confira a configuração Web do Firebase e recarregue a página.</p></main>)
})
