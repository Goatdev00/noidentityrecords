import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState'
import EventFlyerBackdrop from '../components/EventFlyerBackdrop'
import { fetchUpcomingEvents, splitDate, type EventRow } from '../lib/events'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; events: EventRow[] }

export default function Eventos() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchUpcomingEvents()
      .then((events) => !cancelled && setState({ status: 'ready', events }))
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status">
        <p className="noid-label animate-pulse">CARGANDO</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <EmptyState
        label="EVENTOS"
        title="ALGO SALIÓ MAL"
        copy="NO PUDIMOS CARGAR LOS EVENTOS. REVISA TU CONEXIÓN E INTENTA DE NUEVO."
      />
    )
  }

  if (state.events.length === 0) {
    return (
      <EmptyState
        label="EVENTOS"
        title="PRONTO ANUNCIAREMOS FECHAS"
        copy="SÍGUENOS EN NUESTRAS REDES PARA ENTERARTE DEL PRÓXIMO EVENTO."
      />
    )
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col items-center gap-6 text-center">
        <h1 className="noid-title text-xl leading-relaxed text-white md:text-3xl">
          EVENTOS
        </h1>
      </header>

      <ul className="flex flex-col gap-6">
        {state.events.map((event) => {
          const { day, month, year } = splitDate(event.event_date)
          return (
            <li key={event.id}>
              <div className="noid-card group relative flex flex-col gap-6 overflow-hidden p-8 sm:flex-row sm:items-center sm:justify-between">
                {event.image_url && <EventFlyerBackdrop src={event.image_url} />}
                <div className="relative z-10 flex items-center gap-6 md:gap-10">
                  <div className="flex shrink-0 flex-col items-center border-r border-white/10 pr-6 md:pr-10">
                    <span className="font-display text-3xl font-bold leading-none text-white">
                      {day}
                    </span>
                    <span className="mt-2 text-[10px] uppercase tracking-[0.4em] text-white/40">
                      {month} {year}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="noid-title text-base leading-tight text-white md:text-xl">
                      {event.title}
                    </p>
                    {(event.subtitle || event.venue) && (
                      <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
                        {[event.subtitle, event.venue].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                {event.ticket_url && (
                  <a
                    href={event.ticket_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="noid-button relative z-10 shrink-0 self-start text-center transition-colors group-hover:border-white group-hover:bg-white group-hover:text-black sm:self-center"
                  >
                    Entradas →
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
