import { Link } from 'react-router-dom'
import { BRAND, SOCIALS } from '../../lib/constants'

const FOOTER_LINKS = [
  { label: 'Academia', to: '/academia' },
  { label: 'Merch', to: '/merch' },
  { label: 'Record Label', to: '/label' },
  { label: 'Eventos', to: '/eventos' },
  { label: 'Nosotros', to: '/nosotros' },
  { label: 'Términos', to: '/terminos' },
  { label: 'Contacto', to: '/contacto' },
] as const

/** Footer with the original page's typographic treatment. */
export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/5">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16 text-center">
        <nav
          aria-label="Redes sociales"
          className="flex flex-wrap justify-center gap-x-10 gap-y-4 md:gap-x-20"
        >
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-[10px] uppercase tracking-[0.5em] text-white/40 transition-colors duration-300 hover:text-white"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div aria-hidden="true" className="my-12 h-px w-20 bg-white/10" />

        <nav
          aria-label="Secciones"
          className="flex flex-wrap justify-center gap-x-8 gap-y-3 md:gap-x-12"
        >
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="font-display text-[10px] uppercase tracking-[0.5em] text-white/40 transition-colors duration-300 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <img
          src="/logo-noid-wordmark.png"
          alt="No.Identity Records"
          className="mt-12 h-3.5 w-auto opacity-40"
          loading="lazy"
        />

        <p className="mt-8 text-[9px] tracking-[0.4em] text-white/20">
          {BRAND.copyright}
        </p>
      </div>
    </footer>
  )
}
