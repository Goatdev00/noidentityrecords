import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import CursorLight from '../CursorLight'

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <CursorLight />
      <Header />
      {/* header is fixed: pt clears its two-row mobile height / one-row desktop height */}
      <main className="flex-1 pt-28 md:pt-24">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
