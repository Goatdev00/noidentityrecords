import { useEffect, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ConfirmDialog from '../ConfirmDialog'
import {
  buildEmbedUrl,
  createMediaEmbed,
  deleteMediaEmbed,
  fetchMediaAdmin,
  reorderMedia,
  updateMediaEmbed,
  type AdminEmbed,
  type MediaSection,
} from '../../lib/admin'

const inputClass =
  'w-full min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.05em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const labelClass = 'text-[10px] uppercase tracking-[0.3em] text-white/50'

type Copy = {
  heading: string
  newLabel: string
  publishLabel: string
  emptyText: string
  hint: string
  titleLabel: string
  metaLabel: string
  metaPlaceholder: string
  titlePlaceholder: string
  sourcePlaceholder: string
  note: string
  deleteTitle: string
}

const COPY: Record<MediaSection, Copy> = {
  podcast: {
    heading: 'PODCAST',
    newLabel: '+ Nuevo episodio',
    publishLabel: 'Publicar podcast',
    emptyText: 'AÚN NO HAY PODCASTS. PUBLICA EL PRIMERO.',
    hint: 'la landing muestra 3, Record Label 6',
    titleLabel: 'Título',
    titlePlaceholder: 'Podcast Sessions',
    metaLabel: 'Invitado / artista',
    metaPlaceholder: 'Tepé',
    sourcePlaceholder: 'https://soundcloud.com/noidcol/no-id-podcast-sessions-…',
    note: 'Pega el link del episodio en SoundCloud (o el código <iframe> de «Compartir → Insertar»). Se genera el reproductor automáticamente.',
    deleteTitle: 'ELIMINAR PODCAST',
  },
  specials: {
    heading: 'NO.ID SPECIALS',
    newLabel: '+ Nueva publicación',
    publishLabel: 'Publicar',
    emptyText: 'AÚN NO HAY PUBLICACIONES. SUBE LA PRIMERA.',
    hint: 'Record Label muestra 6 · aquí va todo lo que no es podcast',
    titleLabel: 'Título',
    titlePlaceholder: 'Specials 003 / Premiere / Collection…',
    metaLabel: 'Artista',
    metaPlaceholder: 'I-AM',
    sourcePlaceholder: 'https://soundcloud.com/noidcol/… (o link de Bandcamp)',
    note: 'Pega el link de SoundCloud o Bandcamp (o el código <iframe> de «Compartir → Insertar»). Se genera el reproductor automáticamente.',
    deleteTitle: 'ELIMINAR PUBLICACIÓN',
  },
}

function MediaForm({
  section,
  initial,
  onSaved,
  onCancel,
}: {
  section: MediaSection
  initial?: AdminEmbed
  onSaved: () => void
  onCancel: () => void
}) {
  const c = COPY[section]
  const [title, setTitle] = useState(
    initial?.title ?? (section === 'podcast' ? 'Podcast Sessions' : ''),
  )
  const [meta, setMeta] = useState(initial?.meta ?? '')
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = source ? buildEmbedUrl(source) : null

  const save = async () => {
    if (!initial && !source.trim()) return setError('Pega el enlace (SoundCloud o Bandcamp).')
    if (source.trim() && !buildEmbedUrl(source))
      return setError('No reconocí el link. Pega una URL de SoundCloud o Bandcamp.')
    setSaving(true)
    setError(null)
    try {
      if (initial) {
        await updateMediaEmbed(initial.id, { title, meta, ...(source.trim() ? { source } : {}) })
      } else {
        await createMediaEmbed({ title, meta: meta || null, source, section })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
      setSaving(false)
    }
  }

  return (
    <div className="noid-card flex flex-col gap-5 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className={labelClass}>{c.titleLabel}</label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={c.titlePlaceholder}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className={labelClass}>{c.metaLabel}</label>
          <input
            className={inputClass}
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            placeholder={c.metaPlaceholder}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass}>{initial ? 'Reemplazar enlace (opcional)' : 'Enlace *'}</label>
        <input
          className={inputClass}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={c.sourcePlaceholder}
        />
        <p className="text-[9px] uppercase leading-relaxed tracking-[0.2em] text-white/35">{c.note}</p>
      </div>

      {preview && (
        <div className="border border-white/10">
          <iframe
            src={preview.embed_url}
            title="Vista previa"
            width="100%"
            height={preview.height}
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            scrolling="no"
          />
        </div>
      )}

      {error && <p className="text-xs tracking-[0.1em] text-accent">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => void save()} disabled={saving} className="noid-button disabled:opacity-40">
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : c.publishLabel}
        </button>
        <button onClick={onCancel} className="text-[10px] uppercase tracking-[0.25em] text-white/40 hover:text-white">
          Cancelar
        </button>
      </div>
    </div>
  )
}

/** One draggable row (used when no row is being edited). */
function SortableRow({
  e,
  index,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  e: AdminEmbed
  index: number
  busy: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: e.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="noid-card flex flex-wrap items-center justify-between gap-4 px-5 py-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar ${e.title}${e.meta ? ` · ${e.meta}` : ''}`}
          className="shrink-0 cursor-grab touch-none px-1 text-white/30 transition-colors hover:text-white active:cursor-grabbing"
          title="Arrastra para reordenar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
          </svg>
        </button>
        <span className="w-5 shrink-0 text-center font-display text-sm text-white/30">{index + 1}</span>
        <div className="min-w-0">
          <p className="truncate font-display text-[12px] uppercase tracking-[0.15em] text-white">
            {e.title}
            {e.meta && <span className="text-white/40"> · {e.meta}</span>}
          </p>
          <p className="mt-1 text-[10px] tracking-[0.15em] text-white/40">
            {e.created_at.slice(0, 10)}
            {!e.active && ' · OCULTO'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <button
          onClick={onToggle}
          disabled={busy}
          className="text-[9px] uppercase tracking-[0.25em] text-white/50 hover:text-white disabled:opacity-40"
        >
          {e.active ? 'Ocultar' : 'Mostrar'}
        </button>
        <button
          onClick={onEdit}
          className="text-[9px] uppercase tracking-[0.25em] text-white/50 hover:text-white"
        >
          Editar
        </button>
        <button
          onClick={onDelete}
          className="text-[9px] uppercase tracking-[0.25em] text-white/30 hover:text-accent"
        >
          Eliminar
        </button>
      </div>
    </li>
  )
}

export default function MediaAdmin({ section }: { section: MediaSection }) {
  const c = COPY[section]
  const [items, setItems] = useState<AdminEmbed[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AdminEmbed | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const reload = () =>
    fetchMediaAdmin(section)
      .then(setItems)
      .catch(() => setItems([]))

  useEffect(() => {
    setItems(null)
    setCreating(false)
    setEditing(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !items) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next) // optimistic
    reorderMedia(next.map((i) => i.id)).catch(() => reload())
  }

  const toggle = async (e: AdminEmbed) => {
    setBusy(e.id)
    try {
      await updateMediaEmbed(e.id, { active: !e.active })
      await reload()
    } finally {
      setBusy(null)
    }
  }

  const onDelete = async () => {
    const t = pendingDelete
    setPendingDelete(null)
    if (!t) return
    await deleteMediaEmbed(t.id).catch(() => {})
    reload()
  }

  const activeCount = items?.filter((i) => i.active).length ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="noid-label">{c.heading}</h2>
          {items && (
            <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
              {activeCount} activos · {c.hint}
            </p>
          )}
        </div>
        {!creating && !editing && (
          <button onClick={() => setCreating(true)} className="noid-button">
            {c.newLabel}
          </button>
        )}
      </div>

      {creating && (
        <MediaForm
          section={section}
          onSaved={() => {
            setCreating(false)
            reload()
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {items === null ? (
        <p className="noid-label animate-pulse py-8 text-center" role="status">
          CARGANDO
        </p>
      ) : items.length === 0 && !creating ? (
        <p className="py-8 text-center text-xs tracking-[0.15em] text-white/40">{c.emptyText}</p>
      ) : editing ? (
        // editing a row → plain list (drag off), the edited row shows the form
        <ol className="flex flex-col gap-3">
          {items.map((e, i) =>
            editing === e.id ? (
              <li key={e.id}>
                <MediaForm
                  section={section}
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
                className="noid-card flex items-center gap-3 px-5 py-4 opacity-50"
              >
                <span className="w-5 text-center font-display text-sm text-white/30">{i + 1}</span>
                <p className="truncate font-display text-[12px] uppercase tracking-[0.15em] text-white">
                  {e.title}
                  {e.meta && <span className="text-white/40"> · {e.meta}</span>}
                </p>
              </li>
            ),
          )}
        </ol>
      ) : (
        <>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">
            Arrastra ⠿ para reordenar · el primero se muestra arriba en la web
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-3">
                {items.map((e, i) => (
                  <SortableRow
                    key={e.id}
                    e={e}
                    index={i}
                    busy={busy === e.id}
                    onToggle={() => void toggle(e)}
                    onEdit={() => setEditing(e.id)}
                    onDelete={() => setPendingDelete(e)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={c.deleteTitle}
        copy={`SE ELIMINARÁ "${pendingDelete?.title}${pendingDelete?.meta ? ` · ${pendingDelete.meta}` : ''}". ESTA ACCIÓN NO SE PUEDE DESHACER.`}
        confirmLabel="Eliminar"
        onConfirm={() => void onDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
