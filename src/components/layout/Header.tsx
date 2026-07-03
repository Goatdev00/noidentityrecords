import { Link, NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../../lib/constants'

function PersonIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6" />
    </svg>
  )
}

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-black/60 backdrop-blur-md">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-y-2 px-5 py-4 md:grid-cols-[1fr_auto_1fr] md:px-8">
        <Link
          to="/"
          className="noid-title text-sm leading-none text-white transition-opacity duration-300 hover:opacity-60"
          aria-label="No.ID Records — inicio"
        >
          NO.ID
        </Link>

        <Link
          to="/login"
          className="justify-self-end p-1 text-white/60 transition-colors duration-300 hover:text-white md:order-3"
          aria-label="Iniciar sesión"
        >
          <PersonIcon />
        </Link>

        <nav
          aria-label="Navegación principal"
          className="col-span-2 flex items-center justify-center gap-6 md:order-2 md:col-span-1 md:gap-10"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `font-display text-[10px] uppercase tracking-[0.35em] transition-colors duration-300 md:text-[11px] ${
                  isActive ? 'text-white' : 'text-white/40 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
