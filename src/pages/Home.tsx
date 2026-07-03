import { Link } from 'react-router-dom'
import { BRAND } from '../lib/constants'

const SECTIONS = [
  {
    label: 'ACADEMIA',
    copy: 'CURSOS DE PRODUCCIÓN. ACCESO PERMANENTE.',
    to: '/academia',
  },
  {
    label: 'MERCH',
    copy: 'ROPA DEL COLECTIVO. EDICIONES LIMITADAS.',
    to: '/merch',
  },
  {
    label: 'MÚSICA',
    copy: 'LANZAMIENTOS Y SESIONES. ESCUCHA EL VACÍO.',
    to: '/musica',
  },
] as const

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5 md:px-8">
      {/* hero */}
      <section className="flex min-h-[70vh] flex-col items-center justify-center gap-10 py-24 text-center">
        <img
          src="/logo-noid-wordmark.png"
          alt="No.ID Records"
          className="w-52 animate-float md:w-72"
        />
        <div className="flex flex-col gap-6">
          <h1 className="noid-title text-2xl leading-relaxed text-white md:text-4xl">
            NO.ID RECORDS
          </h1>
          <p className="noid-label text-center">
            TECHNO · {BRAND.city}
          </p>
        </div>
        <p className="max-w-md text-sm leading-loose tracking-[0.15em] text-white/50">
          SELLO Y COLECTIVO. {BRAND.tagline}.
        </p>
      </section>

      {/* three doors */}
      <section
        aria-label="Secciones"
        className="grid grid-cols-1 gap-5 pb-28 md:grid-cols-3"
      >
        {SECTIONS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="noid-card group flex flex-col gap-8 p-10"
          >
            <span className="font-display text-xs uppercase tracking-[0.5em] text-white/40 transition-colors duration-500 group-hover:text-white">
              {s.label}
            </span>
            <span className="text-xs leading-loose tracking-[0.15em] text-white/30 transition-colors duration-500 group-hover:text-white/60">
              {s.copy}
            </span>
            <span
              aria-hidden="true"
              className="mt-auto text-white/20 transition-all duration-500 group-hover:translate-x-2 group-hover:text-white"
            >
              →
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}
