import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

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

/**
 * The header's person slot: link to /login without a session, avatar with
 * dropdown menu (perfil / cursos / pedidos / panel for teachers / salir)
 * with one.
 */
export default function UserMenu() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!session) {
    return (
      <Link
        to="/login"
        className="justify-self-end p-1 text-white/60 transition-colors duration-300 hover:text-white md:order-3"
        aria-label="Iniciar sesión"
      >
        <PersonIcon />
      </Link>
    )
  }

  const initial = (profile?.display_name || session.user.email || '?')
    .charAt(0)
    .toUpperCase()
  const isTeacher = profile?.role === 'teacher' || profile?.role === 'admin'

  const itemClass =
    'block w-full px-5 py-3 text-left text-[10px] uppercase tracking-[0.25em] text-white/50 transition-colors duration-200 hover:bg-white/5 hover:text-white'

  return (
    <div ref={rootRef} className="relative justify-self-end md:order-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de usuario"
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/15 transition-colors duration-300 hover:border-white/50"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-[11px] text-white/70">{initial}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-3 w-52 border border-white/10 bg-black/95 py-2 backdrop-blur-md"
        >
          <Link role="menuitem" to="/perfil" onClick={() => setOpen(false)} className={itemClass}>
            Mi perfil
          </Link>
          <Link role="menuitem" to="/perfil#cursos" onClick={() => setOpen(false)} className={itemClass}>
            Mis cursos
          </Link>
          <Link role="menuitem" to="/perfil#pedidos" onClick={() => setOpen(false)} className={itemClass}>
            Mis pedidos
          </Link>
          {isTeacher && (
            <Link role="menuitem" to="/panel" onClick={() => setOpen(false)} className={itemClass}>
              Panel de maestro
            </Link>
          )}
          <div aria-hidden="true" className="mx-5 my-2 h-px bg-white/10" />
          <button
            role="menuitem"
            type="button"
            className={itemClass}
            onClick={async () => {
              setOpen(false)
              await signOut()
              navigate('/')
            }}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
