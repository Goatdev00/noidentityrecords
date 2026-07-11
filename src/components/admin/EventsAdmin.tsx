import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import {
  createEvent,
  deleteEvent,
  fetchAllEventsAdmin,
  updateEvent,
  uploadMerchImage,
  type AdminEvent,
  type EventInput,
} from '../../lib/admin'

const inputClass =
  'w-full min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.05em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const labelClass = 'text-[10px] uppercase tracking-[0.3em] text-white/50'

const EMPTY: EventInput = {
  title: '',
  subtitle: null,
  venue: null,
  event_date: '',
  ticket_url: null,
  image_url: null,
  active: true,
}

function EventForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: AdminEvent
  onSaved: () => void
  onCancel: () => void
}) {
  const [f, setF] = useState<EventInput>(
    initial
      ? {
          title: initial.title,
          subtitle: initial.subtitle,
          venue: initial.venue,
          event_date: initial.event_date,
          ticket_url: initial.ticket_url,
          image_url: initial.image_url,
          active: initial.active,
        }
      : EMPTY,
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) =>
    setF((prev) => ({ ...prev, [k]: v }))

  const onImage = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      set('image_url', await uploadMerchImage(file, 'events'))
    } catch {
      setError('No se pudo subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!f.title.trim()) return setError('Ponle un título al evento.')
    if (!f.event_date) return setError('Elige la fecha del evento.')
    setSaving(true)
    setError(null)
    try {
      if (initial) await updateEvent(initial.id, f)
      else await createEvent(f)
      onSaved()
    } catch {
      setError('No se pudo guardar el evento.')
      setSaving(false)
    }
  }

  return (
    <div className="noid-card flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Título *</label>
        <input
          className={inputClass}
          value={f.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="LARS HUISMANN"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className={labelClass}>Fecha *</label>
          <input
            type="date"
            className={`${inputClass} [color-scheme:dark]`}
            value={f.event_date}
            onChange={(e) => set('event_date', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className={labelClass}>Lugar</label>
          <input
            className={inputClass}
            value={f.venue ?? ''}
            onChange={(e) => set('venue', e.target.value || null)}
            placeholder="Radio Berlín, Bogotá"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Subtítulo / lineup</label>
        <input
          className={inputClass}
          value={f.subtitle ?? ''}
          onChange={(e) => set('subtitle', e.target.value || null)}
          placeholder="3 Live Acts · Techno"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelClass}>Link de entradas</label>
        <input
          className={inputClass}
          value={f.ticket_url ?? ''}
          onChange={(e) => set('ticket_url', e.target.value || null)}
          placeholder="https://coccoa.xyz/…"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass}>Imagen / flyer</label>
        <div className="flex items-center gap-4">
          {f.image_url && (
            <img src={f.image_url} alt="" className="h-16 w-16 object-cover" />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="noid-button disabled:opacity-40"
          >
            {uploading ? 'Subiendo…' : f.image_url ? 'Cambiar' : 'Subir imagen'}
          </button>
          {f.image_url && (
            <button
              type="button"
              onClick={() => set('image_url', null)}
              className="text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-accent"
            >
              Quitar
            </button>
          )}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={f.active}
          onChange={(e) => set('active', e.target.checked)}
          className="h-4 w-4 accent-[#9a64ff]"
        />
        <span className="text-xs uppercase tracking-[0.15em] text-white/70">
          Visible en la web
        </span>
      </label>

      {error && <p className="text-xs tracking-[0.1em] text-accent">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => void save()} disabled={saving} className="noid-button disabled:opacity-40">
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear evento'}
        </button>
        <button
          onClick={onCancel}
          className="text-[10px] uppercase tracking-[0.25em] text-white/40 hover:text-white"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function EventsAdmin() {
  const [events, setEvents] = useState<AdminEvent[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AdminEvent | null>(null)

  const reload = () =>
    fetchAllEventsAdmin()
      .then(setEvents)
      .catch(() => setEvents([]))

  useEffect(() => {
    reload()
  }, [])

  const onDelete = async () => {
    const t = pendingDelete
    setPendingDelete(null)
    if (!t) return
    await deleteEvent(t.id).catch(() => {})
    reload()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="noid-label">EVENTOS</h2>
        {!creating && !editing && (
          <button onClick={() => setCreating(true)} className="noid-button">
            + Nuevo evento
          </button>
        )}
      </div>

      {creating && (
        <EventForm
          onSaved={() => {
            setCreating(false)
            reload()
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {events === null ? (
        <p className="noid-label animate-pulse py-8 text-center" role="status">
          CARGANDO
        </p>
      ) : events.length === 0 && !creating ? (
        <p className="py-8 text-center text-xs tracking-[0.15em] text-white/40">
          AÚN NO HAY EVENTOS. CREA EL PRIMERO.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e) =>
            editing === e.id ? (
              <li key={e.id}>
                <EventForm
                  initial={e}
                  onSaved={() => {
                    setEditing(null)
                    reload()
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li
                key={e.id}
                className="noid-card flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-4">
                  {e.image_url ? (
                    <img src={e.image_url} alt="" className="h-12 w-12 shrink-0 object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-white/10 text-[9px] text-white/30">
                      {e.event_date.slice(8, 10)}/{e.event_date.slice(5, 7)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-display text-[12px] uppercase tracking-[0.15em] text-white">
                      {e.title}
                    </p>
                    <p className="mt-1 text-[10px] tracking-[0.15em] text-white/40">
                      {e.event_date}
                      {e.venue && ` · ${e.venue}`}
                      {!e.active && ' · OCULTO'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <button
                    onClick={() => setEditing(e.id)}
                    className="text-[9px] uppercase tracking-[0.25em] text-white/50 hover:text-white"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setPendingDelete(e)}
                    className="text-[9px] uppercase tracking-[0.25em] text-white/30 hover:text-accent"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="ELIMINAR EVENTO"
        copy={`SE ELIMINARÁ "${pendingDelete?.title}". ESTA ACCIÓN NO SE PUEDE DESHACER.`}
        confirmLabel="Eliminar"
        onConfirm={() => void onDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
