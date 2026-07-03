import { useEffect } from 'react'
import { Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import Musica from './pages/Musica'
import Academia from './pages/Academia'
import Merch from './pages/Merch'
import Login from './pages/Login'
import Terminos from './pages/Terminos'
import Contacto from './pages/Contacto'
import NotFound from './pages/NotFound'

const TITLES: Record<string, string> = {
  '/': 'NO.ID RECORDS — THE VOID IS CALLING',
  '/musica': 'Música — NO.ID RECORDS',
  '/academia': 'Academia — NO.ID RECORDS',
  '/merch': 'Merch — NO.ID RECORDS',
  '/login': 'Acceso — NO.ID RECORDS',
  '/terminos': 'Términos — NO.ID RECORDS',
  '/contacto': 'Contacto — NO.ID RECORDS',
}

/**
 * Per-navigation side effects: page title (SPA views otherwise share one
 * title), scroll to top — skipped on back/forward so the browser can restore
 * the previous position — and focus onto <main> so assistive tech announces
 * the view change.
 */
function RouteChange() {
  const { pathname } = useLocation()
  const navType = useNavigationType()

  useEffect(() => {
    document.title = TITLES[pathname] ?? 'Nada aquí — NO.ID RECORDS'
    if (navType !== 'POP') {
      window.scrollTo(0, 0)
      document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true })
    }
  }, [pathname, navType])

  return null
}

export default function App() {
  return (
    <>
      <RouteChange />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/musica" element={<Musica />} />
          <Route path="/academia" element={<Academia />} />
          <Route path="/merch" element={<Merch />} />
          <Route path="/login" element={<Login />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}
