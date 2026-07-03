import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
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
import LessonEditor from './LessonEditor'
import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  duplicateLesson,
  persistPositions,
  renameModule,
  type PanelLesson,
  type PanelModule,
} from '../../lib/panel'

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

const rowButton =
  'text-[9px] uppercase tracking-[0.25em] text-white/35 transition-colors hover:text-white'

function SortableLesson({
  lesson,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  lesson: PanelLesson
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lesson.id, data: { type: 'lesson' } })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3 last:border-b-0 ${
        isDragging ? 'z-10 bg-white/5 opacity-80' : ''
      }`}
    >
      <DragHandle {...attributes} {...listeners} />
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 truncate text-left text-xs tracking-[0.1em] text-white/70 transition-colors hover:text-white"
        title="Editar lección"
      >
        {lesson.title}
      </button>
      <div className="flex shrink-0 gap-4">
        <button type="button" onClick={onEdit} className={rowButton}>
          Editar
        </button>
        <button type="button" onClick={onDuplicate} className={rowButton}>
          Duplicar
        </button>
        <button type="button" onClick={onDelete} className={rowButton}>
          Eliminar
        </button>
      </div>
    </li>
  )
}

function SortableModule({
  module,
  index,
  children,
  onRename,
  onDelete,
  onAddLesson,
}: {
  module: PanelModule
  index: number
  children: React.ReactNode
  onRename: (title: string) => void
  onDelete: () => void
  onAddLesson: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: module.id, data: { type: 'module' } })
  const [title, setTitle] = useState(module.title)

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`noid-card ${isDragging ? 'z-10 opacity-80' : ''}`}
      aria-label={`Módulo ${index + 1}: ${module.title}`}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-4">
        <DragHandle {...attributes} {...listeners} />
        <span className="font-display text-[10px] tracking-[0.2em] text-white/30">
          {String(index + 1).padStart(2, '0')}
        </span>
        <input
          type="text"
          value={title}
          aria-label={`Título del módulo ${index + 1}`}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const t = title.trim()
            if (t && t !== module.title) onRename(t)
            else setTitle(module.title)
          }}
          className="min-w-0 flex-1 border-0 bg-transparent font-display text-[11px] uppercase tracking-[0.2em] text-white focus:outline-none"
        />
        <div className="flex shrink-0 gap-4">
          <button type="button" onClick={onAddLesson} className={rowButton}>
            + Lección
          </button>
          <button type="button" onClick={onDelete} className={rowButton}>
            Eliminar
          </button>
        </div>
      </header>
      {children}
    </section>
  )
}

type PendingDelete =
  | { kind: 'module'; id: string; title: string }
  | { kind: 'lesson'; id: string; title: string }

/**
 * Modules & lessons editor: create, rename, delete, duplicate, and reorder
 * with drag & drop (lessons can move across modules). Every drop persists
 * `position` (and `module_id`) to the database.
 */
export default function ContentEditor({
  courseId,
  modules,
  setModules,
  reload,
}: {
  courseId: string
  modules: PanelModule[]
  setModules: (m: PanelModule[]) => void
  reload: () => void
}) {
  const [editing, setEditing] = useState<PanelLesson | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const findModuleOf = (lessonId: string) =>
    modules.find((m) => m.lessons.some((l) => l.id === lessonId))

  const persist = async (next: PanelModule[]) => {
    setModules(next)
    try {
      await persistPositions(next)
    } catch {
      setError('No se pudo guardar el orden. Recargando…')
      reload()
    }
  }

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over || active.data.current?.type !== 'lesson') return
    const activeModule = findModuleOf(String(active.id))
    const overModule =
      modules.find((m) => m.id === String(over.id)) ?? findModuleOf(String(over.id))
    if (!activeModule || !overModule || activeModule.id === overModule.id) return

    // move the lesson into the module it's hovering over
    const lesson = activeModule.lessons.find((l) => l.id === String(active.id))!
    const overIndex = overModule.lessons.findIndex((l) => l.id === String(over.id))
    const insertAt = overIndex >= 0 ? overIndex : overModule.lessons.length
    setModules(
      modules.map((m) => {
        if (m.id === activeModule.id)
          return { ...m, lessons: m.lessons.filter((l) => l.id !== lesson.id) }
        if (m.id === overModule.id) {
          const lessons = [...m.lessons]
          lessons.splice(insertAt, 0, { ...lesson, module_id: m.id })
          return { ...m, lessons }
        }
        return m
      }),
    )
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) {
      if (active.data.current?.type === 'lesson') void persist(modules)
      return
    }

    if (active.data.current?.type === 'module') {
      const from = modules.findIndex((m) => m.id === String(active.id))
      const to = modules.findIndex((m) => m.id === String(over.id))
      if (from >= 0 && to >= 0) void persist(arrayMove(modules, from, to))
      return
    }

    // lesson reorder within its (possibly new) module
    const mod = findModuleOf(String(active.id))
    if (!mod) return
    const from = mod.lessons.findIndex((l) => l.id === String(active.id))
    const to = mod.lessons.findIndex((l) => l.id === String(over.id))
    const next =
      from >= 0 && to >= 0
        ? modules.map((m) =>
            m.id === mod.id ? { ...m, lessons: arrayMove(m.lessons, from, to) } : m,
          )
        : modules
    void persist(next)
  }

  const addModule = async () => {
    const title = newModuleTitle.trim()
    if (!title) return
    setError(null)
    try {
      const mod = await createModule(courseId, title, modules.length + 1)
      setModules([...modules, mod])
      setNewModuleTitle('')
    } catch {
      setError('No se pudo crear el módulo.')
    }
  }

  const addLesson = async (moduleId: string) => {
    setError(null)
    const mod = modules.find((m) => m.id === moduleId)
    if (!mod) return
    try {
      const lesson = await createLesson(moduleId, 'Nueva lección', mod.lessons.length + 1)
      setModules(
        modules.map((m) =>
          m.id === moduleId ? { ...m, lessons: [...m.lessons, lesson] } : m,
        ),
      )
      setEditing(lesson)
    } catch {
      setError('No se pudo crear la lección.')
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setError(null)
    try {
      if (pendingDelete.kind === 'module') {
        await deleteModule(pendingDelete.id)
        setModules(modules.filter((m) => m.id !== pendingDelete.id))
      } else {
        await deleteLesson(pendingDelete.id)
        setModules(
          modules.map((m) => ({
            ...m,
            lessons: m.lessons.filter((l) => l.id !== pendingDelete.id),
          })),
        )
      }
    } catch {
      setError('No se pudo eliminar. Intenta de nuevo.')
    } finally {
      setPendingDelete(null)
    }
  }

  const onDuplicate = async (lesson: PanelLesson) => {
    setError(null)
    const mod = findModuleOf(lesson.id)
    if (!mod) return
    try {
      const copy = await duplicateLesson(lesson, mod.lessons.length + 1)
      setModules(
        modules.map((m) =>
          m.id === mod.id ? { ...m, lessons: [...m.lessons, copy] } : m,
        ),
      )
    } catch {
      setError('No se pudo duplicar la lección.')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={newModuleTitle}
          onChange={(e) => setNewModuleTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void addModule()
            }
          }}
          placeholder="TÍTULO DEL NUEVO MÓDULO"
          aria-label="Título del nuevo módulo"
          className="min-w-0 flex-1 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.1em] text-white placeholder:text-white/25 transition-colors duration-300 focus:border-white/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void addModule()}
          disabled={!newModuleTitle.trim()}
          className="noid-button disabled:opacity-40"
        >
          + Módulo
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs tracking-[0.1em] text-accent">
          {error}
        </p>
      )}

      {modules.length === 0 ? (
        <div className="noid-card flex flex-col items-center gap-4 p-12 text-center">
          <p className="text-xs leading-loose tracking-[0.15em] text-white/40">
            EL CURSO AÚN NO TIENE CONTENIDO. CREA EL PRIMER MÓDULO Y AGREGA
            LECCIONES DENTRO.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-6">
              {modules.map((mod, mi) => (
                <SortableModule
                  key={mod.id}
                  module={mod}
                  index={mi}
                  onRename={(t) =>
                    renameModule(mod.id, t)
                      .then(() =>
                        setModules(
                          modules.map((m) => (m.id === mod.id ? { ...m, title: t } : m)),
                        ),
                      )
                      .catch(() => setError('No se pudo renombrar el módulo.'))
                  }
                  onDelete={() =>
                    setPendingDelete({ kind: 'module', id: mod.id, title: mod.title })
                  }
                  onAddLesson={() => void addLesson(mod.id)}
                >
                  <SortableContext
                    items={mod.lessons.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {mod.lessons.length === 0 ? (
                      <p className="px-6 py-4 text-[10px] tracking-[0.2em] text-white/25">
                        SIN LECCIONES — ARRASTRA UNA AQUÍ O CREA UNA NUEVA.
                      </p>
                    ) : (
                      <ul>
                        {mod.lessons.map((lesson) => (
                          <SortableLesson
                            key={lesson.id}
                            lesson={lesson}
                            onEdit={() => setEditing(lesson)}
                            onDuplicate={() => void onDuplicate(lesson)}
                            onDelete={() =>
                              setPendingDelete({
                                kind: 'lesson',
                                id: lesson.id,
                                title: lesson.title,
                              })
                            }
                          />
                        ))}
                      </ul>
                    )}
                  </SortableContext>
                </SortableModule>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editing && (
        <LessonEditor
          lesson={editing}
          onClose={() => setEditing(null)}
          onSaved={(patch) =>
            setModules(
              modules.map((m) => ({
                ...m,
                lessons: m.lessons.map((l) =>
                  l.id === editing.id ? { ...l, ...patch } : l,
                ),
              })),
            )
          }
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === 'module' ? 'ELIMINAR MÓDULO' : 'ELIMINAR LECCIÓN'}
        copy={
          pendingDelete?.kind === 'module'
            ? `SE ELIMINARÁ "${pendingDelete?.title}" CON TODAS SUS LECCIONES. ESTA ACCIÓN NO SE PUEDE DESHACER.`
            : `SE ELIMINARÁ LA LECCIÓN "${pendingDelete?.title}". ESTA ACCIÓN NO SE PUEDE DESHACER.`
        }
        confirmLabel="Eliminar"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
