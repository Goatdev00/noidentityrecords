import { useEffect, useRef, useState, type FormEvent } from 'react'
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
import { createModuleWithLessons, type LessonDraft, type PanelModule } from '../../lib/panel'

const inputClass =
  'w-full min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.1em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const labelClass = 'text-[10px] uppercase tracking-[0.3em] text-white/40'

type DraftRow = LessonDraft & { key: number }

const emptyLesson = (key: number): DraftRow => ({
  key,
  title: '',
  subtitle: '',
  description: '',
  videoUrl: '',
  links: [],
})

function DragHandle(props: Record<string, unknown>) {
  return (
    <button
      type="button"
      aria-label="Arrastrar para reordenar"
      className="cursor-grab touch-none px-1 text-white/25 transition-colors hover:text-white active:cursor-grabbing"
      {...props}
    >
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
        <circle cx="2" cy="2" r="1.3" />
        <circle cx="8" cy="2" r="1.3" />
        <circle cx="2" cy="7" r="1.3" />
        <circle cx="8" cy="7" r="1.3" />
        <circle cx="2" cy="12" r="1.3" />
        <circle cx="8" cy="12" r="1.3" />
      </svg>
    </button>
  )
}

/** One draggable draft-lesson block inside the new-module dialog. */
function SortableDraftLesson({
  lesson,
  index,
  removable,
  onPatch,
  onRemove,
}: {
  lesson: DraftRow
  index: number
  removable: boolean
  onPatch: (key: number, patch: Partial<DraftRow>) => void
  onRemove: (key: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: String(lesson.key) })

  return (
    <fieldset
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-4 border border-white/5 p-5 ${
        isDragging ? 'z-10 bg-white/5 opacity-80' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DragHandle {...attributes} {...listeners} />
          <legend className="font-display text-[10px] uppercase tracking-[0.25em] text-white/40">
            Lección {index + 1}
          </legend>
        </div>
        {removable && (
          <button
            type="button"
            onClick={() => onRemove(lesson.key)}
            aria-label={`Quitar lección ${index + 1}`}
            className="text-[9px] uppercase tracking-[0.25em] text-white/30 transition-colors hover:text-accent"
          >
            Quitar
          </button>
        )}
      </div>

      <input
        type="text"
        aria-label={`Título de la lección ${index + 1}`}
        placeholder="TÍTULO DE LA LECCIÓN"
        value={lesson.title}
        onChange={(e) => onPatch(lesson.key, { title: e.target.value })}
        className={inputClass}
      />
      <input
        type="text"
        aria-label={`Subtítulo de la lección ${index + 1}`}
        placeholder="SUBTÍTULO (OPCIONAL)"
        value={lesson.subtitle}
        onChange={(e) => onPatch(lesson.key, { subtitle: e.target.value })}
        className={inputClass}
      />
      <textarea
        rows={2}
        aria-label={`Descripción de la lección ${index + 1}`}
        placeholder="DESCRIPCIÓN (OPCIONAL)"
        value={lesson.description}
        onChange={(e) => onPatch(lesson.key, { description: e.target.value })}
        className={inputClass}
      />
      <input
        type="url"
        aria-label={`Link del video de la lección ${index + 1}`}
        placeholder="LINK DEL VIDEO (YOUTUBE O VIMEO)"
        value={lesson.videoUrl}
        onChange={(e) => onPatch(lesson.key, { videoUrl: e.target.value })}
        className={inputClass}
      />

      <div className="flex flex-col gap-2">
        {lesson.links.map((link, li) => (
          <div key={li} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              aria-label={`Etiqueta del link ${li + 1}`}
              placeholder="ETIQUETA"
              value={link.label}
              onChange={(e) =>
                onPatch(lesson.key, {
                  links: lesson.links.map((x, j) => (j === li ? { ...x, label: e.target.value } : x)),
                })
              }
              className={`${inputClass} sm:w-40`}
            />
            <input
              type="url"
              aria-label={`URL del link ${li + 1}`}
              placeholder="https://…"
              value={link.url}
              onChange={(e) =>
                onPatch(lesson.key, {
                  links: lesson.links.map((x, j) => (j === li ? { ...x, url: e.target.value } : x)),
                })
              }
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={() =>
                onPatch(lesson.key, { links: lesson.links.filter((_, j) => j !== li) })
              }
              aria-label={`Eliminar link ${li + 1}`}
              className="px-3 py-2 text-white/40 transition-colors hover:text-white"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onPatch(lesson.key, { links: [...lesson.links, { label: '', url: '' }] })}
          className="self-start text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
        >
          + Agregar link
        </button>
      </div>
    </fieldset>
  )
}

type Props = {
  courseId: string
  position: number
  onClose: () => void
  onCreated: (module: PanelModule) => void
}

/**
 * Create a whole module at once: its title plus any number of lessons with
 * their full content. Lessons can be dragged to reorder while you build them.
 */
export default function ModuleEditor({ courseId, position, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [lessons, setLessons] = useState<DraftRow[]>(() => [emptyLesson(0)])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const keyCounter = useRef(1)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const dirty =
    title.trim() !== '' ||
    lessons.some(
      (l) => l.title || l.subtitle || l.description || l.videoUrl || l.links.length > 0,
    )

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose())

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    titleRef.current?.focus()
    return () => opener?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!confirmDiscard) requestClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current || confirmDiscard) return
      const f = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      if (f.length === 0) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const patchLesson = (key: number, patch: Partial<DraftRow>) =>
    setLessons((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const addLessonRow = () => setLessons((prev) => [...prev, emptyLesson(keyCounter.current++)])

  const removeLessonRow = (key: number) =>
    setLessons((prev) => prev.filter((l) => l.key !== key))

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setLessons((prev) => {
      const from = prev.findIndex((l) => String(l.key) === String(active.id))
      const to = prev.findIndex((l) => String(l.key) === String(over.id))
      return from >= 0 && to >= 0 ? arrayMove(prev, from, to) : prev
    })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('El módulo necesita un título.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const drafts: LessonDraft[] = lessons
        .filter((l) => l.title.trim())
        .map(({ title, subtitle, description, videoUrl, links }) => ({
          title,
          subtitle,
          description,
          videoUrl,
          links,
        }))
      const module = await createModuleWithLessons(courseId, title.trim(), position, drafts)
      onCreated(module)
      onClose()
    } catch {
      setError('No se pudo crear el módulo. Intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/90 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo módulo"
        className="mx-auto my-10 w-full max-w-2xl border border-white/10 bg-black p-8 md:p-10"
      >
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 className="noid-title text-sm text-white">NUEVO MÓDULO</h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar"
            className="p-2 text-white/40 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <label htmlFor="m-title" className={labelClass}>
              Título del módulo
            </label>
            <input
              id="m-title"
              ref={titleRef}
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="MÓDULO 1 — FUNDAMENTOS"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className={labelClass}>Lecciones</p>
              {lessons.length > 1 && (
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/25">
                  Arrastra ⠿ para reordenar
                </p>
              )}
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={lessons.map((l) => String(l.key))}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-5">
                  {lessons.map((lesson, i) => (
                    <SortableDraftLesson
                      key={lesson.key}
                      lesson={lesson}
                      index={i}
                      removable={lessons.length > 1}
                      onPatch={patchLesson}
                      onRemove={removeLessonRow}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              type="button"
              onClick={addLessonRow}
              className="self-start text-[10px] uppercase tracking-[0.3em] text-white/50 transition-colors hover:text-white"
            >
              + Agregar otra lección
            </button>
          </div>

          {error && (
            <p role="alert" className="text-xs tracking-[0.1em] text-accent">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-4 border-t border-white/5 pt-6">
            <button
              type="button"
              onClick={requestClose}
              className="px-6 py-4 font-display text-[11px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
            >
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="noid-button disabled:opacity-40">
              {saving ? 'Creando…' : 'Crear módulo'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="DESCARTAR MÓDULO"
        copy="TIENES INFORMACIÓN SIN GUARDAR. SI SALES AHORA, SE PERDERÁ."
        confirmLabel="Salir sin guardar"
        onConfirm={onClose}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  )
}
