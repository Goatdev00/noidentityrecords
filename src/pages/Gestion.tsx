import { useState } from 'react'
import EventsAdmin from '../components/admin/EventsAdmin'
import MerchAdmin from '../components/admin/MerchAdmin'

type Tab = 'eventos' | 'merch'

const TABS: { id: Tab; label: string }[] = [
  { id: 'eventos', label: 'Eventos' },
  { id: 'merch', label: 'Merch' },
]

export default function Gestion() {
  const [tab, setTab] = useState<Tab>('eventos')

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col gap-4">
        <p className="noid-label">GESTIÓN</p>
        <h1 className="noid-title text-lg leading-relaxed text-white md:text-2xl">
          EVENTOS Y TIENDA
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
    </div>
  )
}
