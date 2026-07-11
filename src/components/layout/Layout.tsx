import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import CursorLight from '../CursorLight'
import CartDrawer from '../merch/CartDrawer'

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* keyboard users can jump past the fixed header */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:border focus:border-white focus:bg-black focus:px-5 focus:py-3 focus:font-display focus:text-[11px] focus:uppercase focus:tracking-[0.3em] focus:text-white"
      >
        Saltar al contenido
      </a>
      <CursorLight />
      <Header />
      <CartDrawer />
      {/* header is fixed: pt clears its two-row mobile height / one-row desktop height.
          tabIndex -1 lets RouteChange move focus here on navigation */}
      <main id="contenido" tabIndex={-1} className="flex-1 pt-32 outline-none md:pt-24">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
