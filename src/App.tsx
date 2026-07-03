import { useEffect } from 'react'
import { Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { AuthProvider } from './lib/auth'
import { RequireAuth, RequireTeacher } from './components/guards'
import Home from './pages/Home'
import Musica from './pages/Musica'
import Academia from './pages/Academia'
import Curso from './pages/Curso'
import Merch from './pages/Merch'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Perfil from './pages/Perfil'
import Panel from './pages/Panel'
import PanelCurso from './pages/PanelCurso'
import Terminos from './pages/Terminos'
import Contacto from './pages/Contacto'
import NotFound from './pages/NotFound'

const TITLES: Record<string, string> = {
  '/': 'NO.ID RECORDS — THE VOID IS CALLING',
  '/musica': 'Música — NO.ID RECORDS',
  '/academia': 'Academia — NO.ID RECORDS',
  '/merch': 'Merch — NO.ID RECORDS',
  '/login': 'Acceso — NO.ID RECORDS',
  '/restablecer': 'Nueva contraseña — NO.ID RECORDS',
  '/perfil': 'Mi perfil — NO.ID RECORDS',
  '/panel': 'Panel de maestro — NO.ID RECORDS',
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
  const { pathname, hash } = useLocation()
  const navType = useNavigationType()

  useEffect(() => {
    // detail pages (e.g. /academia/:slug) refine the title themselves
    document.title =
      TITLES[pathname] ??
      (pathname.startsWith('/academia/')
        ? 'Academia — NO.ID RECORDS'
        : pathname.startsWith('/panel/')
          ? 'Panel de maestro — NO.ID RECORDS'
          : 'Nada aquí — NO.ID RECORDS')
    if (navType === 'POP') return
    if (hash) {
      // anchor navigation (e.g. /perfil#cursos) — honor it instead of top
      document.getElementById(hash.slice(1))?.scrollIntoView()
      return
    }
    window.scrollTo(0, 0)
    document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true })
  }, [pathname, hash, navType])

  return null
}

export default function App() {
  return (
    <AuthProvider>
      <RouteChange />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/musica" element={<Musica />} />
          <Route path="/academia" element={<Academia />} />
          <Route path="/academia/:slug" element={<Curso />} />
          <Route path="/merch" element={<Merch />} />
          <Route path="/login" element={<Login />} />
          <Route path="/restablecer" element={<ResetPassword />} />
          <Route
            path="/perfil"
            element={
              <RequireAuth>
                <Perfil />
              </RequireAuth>
            }
          />
          <Route
            path="/panel"
            element={
              <RequireTeacher>
                <Panel />
              </RequireTeacher>
            }
          />
          <Route
            path="/panel/curso/:id"
            element={
              <RequireTeacher>
                <PanelCurso />
              </RequireTeacher>
            }
          />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
