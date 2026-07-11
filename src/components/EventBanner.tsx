import { useEffect, useState } from 'react'
import { fetchNextEvent, splitDate, type EventRow } from '../lib/events'

/**
 * Big horizontal strip on the home page announcing the next upcoming event,
 * linking straight to the ticket page.
 */
export default function EventBanner() {
  const [event, setEvent] = useState<EventRow | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchNextEvent()
      .then((e) => !cancelled && setEvent(e))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!event) return null
  const { day, month, year } = splitDate(event.event_date)

  const inner = (
    <div className="noid-card group flex flex-col gap-6 overflow-hidden p-8 sm:flex-row sm:items-center sm:justify-between md:p-10">
      <div className="flex items-center gap-6 md:gap-10">
        <div className="flex shrink-0 flex-col items-center border-r border-white/10 pr-6 md:pr-10">
          <span className="font-display text-3xl font-bold leading-none text-white md:text-4xl">
            {day}
          </span>
          <span className="mt-2 text-[10px] uppercase tracking-[0.4em] text-white/40">
            {month} {year}
          </span>
        </div>
        <div className="min-w-0">
          <p className="mb-3 text-[9px] uppercase tracking-[0.5em] text-accent">
            Próximo evento
          </p>
          <p className="noid-title text-lg leading-tight text-white md:text-2xl">
            {event.title}
          </p>
          {(event.subtitle || event.venue) && (
            <p className="mt-2 truncate text-[10px] uppercase tracking-[0.3em] text-white/40">
              {[event.subtitle, event.venue].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
      {event.ticket_url && (
        <span className="noid-button shrink-0 self-start text-center transition-colors group-hover:border-white group-hover:bg-white group-hover:text-black sm:self-center">
          Entradas →
        </span>
      )}
    </div>
  )

  return event.ticket_url ? (
    <a
      href={event.ticket_url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Entradas para ${event.title}, ${day} de ${month}`}
      className="block"
    >
      {inner}
    </a>
  ) : (
    inner
  )
}
