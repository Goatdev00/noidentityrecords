import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { AuthProvider } from './lib/auth'
import { CartProvider } from './lib/cart'
import { RequireAuth, RequireTeacher, RequireSuper } from './components/guards'
import Home from './pages/Home'
import RecordLabel from './pages/RecordLabel'
import Eventos from './pages/Eventos'
import Nosotros from './pages/Nosotros'
import Academia from './pages/Academia'
import Curso from './pages/Curso'
import Aprender from './pages/Aprender'
import Merch from './pages/Merch'
import Producto from './pages/Producto'
import Checkout from './pages/Checkout'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Perfil from './pages/Perfil'
import Panel from './pages/Panel'
import PanelCurso from './pages/PanelCurso'
import Mailing from './pages/Mailing'
import Verificar from './pages/Verificar'
import Terminos from './pages/Terminos'
import Contacto from './pages/Contacto'
import NotFound from './pages/NotFound'

const TITLES: Record<string, string> = {
  '/': 'NO.IDENTITY RECORDS',
  '/label': 'Record Label — NO.IDENTITY RECORDS',
  '/eventos': 'Eventos — NO.IDENTITY RECORDS',
  '/nosotros': 'Nosotros — NO.IDENTITY RECORDS',
  '/academia': 'Academia — NO.IDENTITY RECORDS',
  '/merch': 'Merch — NO.IDENTITY RECORDS',
  '/checkout': 'Finalizar compra — NO.IDENTITY RECORDS',
  '/login': 'Acceso — NO.IDENTITY RECORDS',
  '/restablecer': 'Nueva contraseña — NO.IDENTITY RECORDS',
  '/perfil': 'Mi perfil — NO.IDENTITY RECORDS',
  '/panel': 'Panel de maestro — NO.IDENTITY RECORDS',
  '/mailing': 'Mailing — NO.IDENTITY RECORDS',
  '/terminos': 'Términos — NO.IDENTITY RECORDS',
  '/contacto': 'Contacto — NO.IDENTITY RECORDS',
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
        ? 'Academia — NO.IDENTITY RECORDS'
        : pathname.startsWith('/merch/')
          ? 'Merch — NO.IDENTITY RECORDS'
          : pathname.startsWith('/panel/')
            ? 'Panel de maestro — NO.IDENTITY RECORDS'
            : pathname.startsWith('/verificar/')
              ? 'Verificar certificado — NO.IDENTITY RECORDS'
              : 'Nada aquí — NO.IDENTITY RECORDS')
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
      <CartProvider>
        <RouteChange />
        <Routes>
          <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/label" element={<RecordLabel />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/nosotros" element={<Nosotros />} />
          {/* legacy URL from the old structure */}
          <Route path="/musica" element={<Navigate to="/label" replace />} />
          <Route path="/academia" element={<Academia />} />
          <Route path="/academia/:slug" element={<Curso />} />
          <Route
            path="/academia/:slug/aprender"
            element={
              <RequireAuth>
                <Aprender />
              </RequireAuth>
            }
          />
          <Route path="/merch" element={<Merch />} />
          <Route path="/merch/:slug" element={<Producto />} />
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
          <Route
            path="/mailing"
            element={
              <RequireSuper>
                <Mailing />
              </RequireSuper>
            }
          />
          <Route path="/verificar/:code" element={<Verificar />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </CartProvider>
    </AuthProvider>
  )
}
