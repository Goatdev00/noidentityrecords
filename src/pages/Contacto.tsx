import EmptyState from '../components/EmptyState'
import { SOCIALS } from '../lib/constants'

export default function Contacto() {
  return (
    <EmptyState
      label="CONTACTO"
      title="HABLEMOS"
      copy="ESCRÍBENOS POR CUALQUIERA DE NUESTROS CANALES."
    >
      <nav aria-label="Canales de contacto" className="flex flex-col gap-4">
        {SOCIALS.map((s) => (
          <a
            key={s.label}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display text-[10px] uppercase tracking-[0.35em] text-white/40 transition-colors duration-300 hover:text-white"
          >
            {s.label}
          </a>
        ))}
      </nav>
    </EmptyState>
  )
}
