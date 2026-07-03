import type { ReactNode } from 'react'
import AudioEmbed from '../components/AudioEmbed'
import { MEDIA_EMBEDS, OTHER_PLATFORMS } from '../data/mediaEmbeds'

/** Section with the original left-aligned label treatment (tracking 0.8em, 40%). */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label}>
      <h2 className="noid-label mb-10 pl-2">{label}</h2>
      {children}
    </section>
  )
}

export default function Musica() {
  const bandcamp = MEDIA_EMBEDS.filter(
    (e) => e.active && e.platform === 'bandcamp',
  ).sort((a, b) => a.position - b.position)
  const soundcloud = MEDIA_EMBEDS.filter(
    (e) => e.active && e.platform === 'soundcloud',
  ).sort((a, b) => a.position - b.position)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-32 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col items-center gap-6 text-center">
        <h1 className="noid-title text-xl leading-relaxed text-white md:text-3xl">
          MÚSICA
        </h1>
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
          Escucha el vacío
        </p>
      </header>

      {bandcamp.length > 0 && (
        <Section label="BANDCAMP">
          <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-3">
            {bandcamp.map((e) => (
              <AudioEmbed key={e.id} embed={e} />
            ))}
          </div>
        </Section>
      )}

      {soundcloud.length > 0 && (
        <Section label="SOUNDCLOUD">
          <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-3">
            {soundcloud.map((e) => (
              <AudioEmbed key={e.id} embed={e} />
            ))}
          </div>
        </Section>
      )}

      <Section label="OTRAS PLATAFORMAS">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {OTHER_PLATFORMS.map((p) => (
            <a
              key={p.label}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="noid-card group flex items-center justify-between px-8 py-6"
            >
              <span className="font-display text-[11px] uppercase tracking-[0.35em] text-white/60 transition-colors duration-500 group-hover:text-white">
                {p.label}
              </span>
              <span
                aria-hidden="true"
                className="text-white/20 transition-all duration-500 group-hover:translate-x-2 group-hover:text-white"
              >
                →
              </span>
            </a>
          ))}
        </div>
      </Section>
    </div>
  )
}
