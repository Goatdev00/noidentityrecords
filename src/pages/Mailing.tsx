import { useState } from 'react'
import MailingContacts from '../components/mailing/MailingContacts'
import MailingCompose from '../components/mailing/MailingCompose'
import MailingHistory from '../components/mailing/MailingHistory'

type Tab = 'redactar' | 'contactos' | 'historial'

const TABS: { id: Tab; label: string }[] = [
  { id: 'redactar', label: 'Redactar' },
  { id: 'contactos', label: 'Contactos' },
  { id: 'historial', label: 'Historial' },
]

export default function Mailing() {
  const [tab, setTab] = useState<Tab>('redactar')
  const [historyKey, setHistoryKey] = useState(0)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col gap-4">
        <p className="noid-label">MAILING</p>
        <h1 className="noid-title text-lg leading-relaxed text-white md:text-2xl">
          CORREO A LA COMUNIDAD
        </h1>
      </header>

      <nav className="flex gap-6 border-b border-white/5" aria-label="Secciones de mailing">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              if (t.id === 'historial') setHistoryKey((k) => k + 1)
            }}
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

      {tab === 'redactar' && <MailingCompose onSent={() => setHistoryKey((k) => k + 1)} />}
      {tab === 'contactos' && <MailingContacts />}
      {tab === 'historial' && <MailingHistory refreshKey={historyKey} />}
    </div>
  )
}
