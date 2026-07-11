import { supabase } from './supabase'

export type EventRow = {
  id: string
  title: string
  subtitle: string | null
  venue: string | null
  event_date: string // ISO date
  ticket_url: string | null
  image_url: string | null
}

const COLUMNS = 'id, title, subtitle, venue, event_date, ticket_url, image_url'

/** Today's date in Bogotá as YYYY-MM-DD (events are date-only). */
function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

/** The next upcoming event, for the home banner. */
export async function fetchNextEvent(): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from('events')
    .select(COLUMNS)
    .gte('event_date', todayISO())
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as EventRow) ?? null
}

/** All upcoming events (soonest first) for /eventos. */
export async function fetchUpcomingEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select(COLUMNS)
    .gte('event_date', todayISO())
    .order('event_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as EventRow[]
}

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

/** '2026-08-07' → { day: '07', month: 'AGO', year: '2026' } (no TZ drift). */
export function splitDate(iso: string): { day: string; month: string; year: string } {
  const [y, m, d] = iso.split('-')
  return { day: d ?? '', month: MONTHS[Number(m) - 1] ?? '', year: y ?? '' }
}
