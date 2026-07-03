import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import CursorLight from '../CursorLight'
import CartDrawer from '../merch/CartDrawer'

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <CursorLight />
      <Header />
      <CartDrawer />
      {/* header is fixed: pt clears its two-row mobile height / one-row desktop height.
          tabIndex -1 lets RouteChange move focus here on navigation */}
      <main tabIndex={-1} className="flex-1 pt-28 outline-none md:pt-24">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
