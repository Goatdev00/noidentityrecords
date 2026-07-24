import { useState } from 'react'
import EventsAdmin from '../components/admin/EventsAdmin'
import MerchAdmin from '../components/admin/MerchAdmin'
import MediaAdmin from '../components/admin/MediaAdmin'
import EnrollmentsAdmin from '../components/admin/EnrollmentsAdmin'
import type { MediaSection } from '../lib/admin'

type Tab = 'eventos' | 'merch' | 'label' | 'inscritos'

const TABS: { id: Tab; label: string }[] = [
  { id: 'eventos', label: 'Eventos' },
  { id: 'merch', label: 'Merch' },
  { id: 'label', label: 'Record Label' },
  { id: 'inscritos', label: 'Inscritos' },
]

const MEDIA_TABS: { id: MediaSection; label: string }[] = [
  { id: 'podcast', label: 'Podcast' },
  { id: 'specials', label: 'NO.ID Specials' },
]

export default function Gestion() {
  const [tab, setTab] = useState<Tab>('eventos')
  const [media, setMedia] = useState<MediaSection>('podcast')

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col gap-4">
        <p className="noid-label">GESTIÓN</p>
        <h1 className="noid-title text-lg leading-relaxed text-white md:text-2xl">
          EVENTOS, TIENDA Y MÚSICA
        </h1>
      </header>

      <nav className="flex gap-6 border-b border-white/5" aria-label="Secciones de gestión">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id}
            className={`-mb-px border-b-2 pb-3 font-display text-[11px] uppercase tracking-[0.25em] transition-colors ${
              tab === t.id
                ? 'border-white text-white'
                : 'border-transparent text-white/40 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'eventos' && <EventsAdmin />}
      {tab === 'merch' && <MerchAdmin />}
      {tab === 'inscritos' && <EnrollmentsAdmin />}
      {tab === 'label' && (
        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap gap-3" role="group" aria-label="Tipo de contenido">
            {MEDIA_TABS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMedia(m.id)}
                aria-pressed={media === m.id}
                className={`border px-4 py-2 text-[10px] uppercase tracking-[0.2em] transition-colors ${
                  media === m.id
                    ? 'border-white bg-white text-black'
                    : 'border-white/20 text-white/60 hover:border-white/50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <MediaAdmin section={media} />
        </div>
      )}
    </div>
  )
}
