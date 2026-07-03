import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
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
import ModuleEditor from './ModuleEditor'
import {
  createLesson,
  deleteLesson,
  deleteModule,
  duplicateLesson,
  duplicateModule,
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
  'text-[9px] uppercase tracking-[0.25em] text-white/35 transition-colors hover:text-white disabled:opacity-40'

function SortableLesson({
  lesson,
  busy,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  lesson: PanelLesson
  busy: boolean
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
        <button type="button" onClick={onDuplicate} disabled={busy} className={rowButton}>
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
  busy,
  children,
  onRename,
  onDuplicate,
  onDelete,
  onAddLesson,
}: {
  module: PanelModule
  index: number
  busy: boolean
  children: React.ReactNode
  onRename: (title: string) => void
  onDuplicate: () => void
  onDelete: () => void
  onAddLesson: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: module.id, data: { type: 'module' } })
  const [title, setTitle] = useState(module.title)

  // resync when the prop changes (failed rename revert, reload, etc.)
  useEffect(() => {
    setTitle(module.title)
  }, [module.title])

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
          <button type="button" onClick={onAddLesson} disabled={busy} className={rowButton}>
            + Lección
          </button>
          <button type="button" onClick={onDuplicate} disabled={busy} className={rowButton}>
            Duplicar
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
 * Modules & lessons editor: create, rename, delete, duplicate (both levels),
 * and reorder with drag & drop (lessons move across modules). Every drop
 * persists `position`/`module_id`; a cancelled drag restores the pre-drag
 * snapshot. All state updates are functional — concurrent saves never
 * clobber each other.
 */
export default function ContentEditor({
  courseId,
  modules,
  setModules,
  reload,
}: {
  courseId: string
  modules: PanelModule[]
  setModules: Dispatch<SetStateAction<PanelModule[]>>
  reload: () => void
}) {
  const [editing, setEditing] = useState<PanelLesson | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [showModuleEditor, setShowModuleEditor] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mutating, setMutating] = useState(false)
  const dragSnapshot = useRef<PanelModule[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // module drags only consider module containers — otherwise closestCenter
  // often resolves to a lesson id and the reorder silently no-ops
  const collisionDetection: CollisionDetection = (args) => {
    if (args.active.data.current?.type === 'module') {
      const moduleIds = new Set(modules.map((m) => m.id))
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) =>
          moduleIds.has(String(c.id)),
        ),
      })
    }
    return closestCenter(args)
  }

  const findModuleOf = (list: PanelModule[], lessonId: string) =>
    list.find((m) => m.lessons.some((l) => l.id === lessonId))

  const onDragStart = (_e: DragStartEvent) => {
    dragSnapshot.current = modules
  }

  const onDragCancel = () => {
    // Escape / pointercancel: dnd-kit fires cancel, not end — undo the
    // cross-module moves onDragOver already applied locally
    if (dragSnapshot.current) setModules(dragSnapshot.current)
    dragSnapshot.current = null
  }

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over || active.data.current?.type !== 'lesson') return
    setModules((current) => {
      const activeModule = findModuleOf(current, String(active.id))
      const overModule =
        current.find((m) => m.id === String(over.id)) ??
        findModuleOf(current, String(over.id))
      if (!activeModule || !overModule || activeModule.id === overModule.id) {
        return current
      }
      const lesson = activeModule.lessons.find((l) => l.id === String(active.id))
      if (!lesson) return current
      const overIndex = overModule.lessons.findIndex((l) => l.id === String(over.id))
      const insertAt = overIndex >= 0 ? overIndex : overModule.lessons.length
      return current.map((m) => {
        if (m.id === activeModule.id)
          return { ...m, lessons: m.lessons.filter((l) => l.id !== lesson.id) }
        if (m.id === overModule.id) {
          const lessons = [...m.lessons]
          lessons.splice(insertAt, 0, { ...lesson, module_id: m.id })
          return { ...m, lessons }
        }
        return m
      })
    })
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    dragSnapshot.current = null

    setModules((current) => {
      let next = current
      if (active.data.current?.type === 'module') {
        const overId = String(over?.id ?? '')
        const from = current.findIndex((m) => m.id === String(active.id))
        // over may be a lesson despite the filter (edge cases) — fall back
        // to the lesson's parent module
        const to = current.findIndex(
          (m) => m.id === overId || m.lessons.some((l) => l.id === overId),
        )
        if (from >= 0 && to >= 0 && from !== to) next = arrayMove(current, from, to)
      } else {
        const mod = findModuleOf(current, String(active.id))
        if (mod && over) {
          const from = mod.lessons.findIndex((l) => l.id === String(active.id))
          const to = mod.lessons.findIndex((l) => l.id === String(over.id))
          if (from >= 0 && to >= 0 && from !== to) {
            next = current.map((m) =>
              m.id === mod.id ? { ...m, lessons: arrayMove(m.lessons, from, to) } : m,
            )
          }
        }
      }
      // persist whatever the tree looks like after the drop — also covers
      // cross-module moves already applied by onDragOver
      persistPositions(next).catch(() => {
        setError('No se pudo guardar el orden. Recargando…')
        reload()
      })
      return next
    })
  }

  const guarded = async (fn: () => Promise<void>, failMsg: string) => {
    if (mutating) return
    setMutating(true)
    setError(null)
    try {
      await fn()
    } catch {
      setError(failMsg)
    } finally {
      setMutating(false)
    }
  }

  const addLesson = (moduleId: string) =>
    guarded(async () => {
      const mod = modules.find((m) => m.id === moduleId)
      if (!mod) return
      const lesson = await createLesson(moduleId, 'Nueva lección', mod.lessons.length + 1)
      setModules((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, lessons: [...m.lessons, lesson] } : m)),
      )
      setEditing(lesson)
    }, 'No se pudo crear la lección.')

  const onDuplicateLesson = (lesson: PanelLesson) =>
    guarded(async () => {
      const mod = findModuleOf(modules, lesson.id)
      if (!mod) return
      const copy = await duplicateLesson(lesson, mod.lessons.length + 1)
      setModules((prev) =>
        prev.map((m) => (m.id === mod.id ? { ...m, lessons: [...m.lessons, copy] } : m)),
      )
    }, 'No se pudo duplicar la lección.')

  const onDuplicateModule = (mod: PanelModule) =>
    guarded(async () => {
      const copy = await duplicateModule(courseId, mod, modules.length + 1)
      setModules((prev) => [...prev, copy])
    }, 'No se pudo duplicar el módulo.')

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setError(null)
    try {
      if (target.kind === 'module') {
        await deleteModule(target.id)
        setModules((prev) => prev.filter((m) => m.id !== target.id))
      } else {
        await deleteLesson(target.id)
        setModules((prev) =>
          prev.map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== target.id) })),
        )
      }
    } catch {
      setError('No se pudo eliminar. Intenta de nuevo.')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <button
        type="button"
        onClick={() => setShowModuleEditor(true)}
        className="noid-button self-start"
      >
        + Nuevo módulo
      </button>

      {error && (
        <p role="alert" className="text-xs tracking-[0.1em] text-accent">
          {error}
        </p>
      )}

      {modules.length === 0 ? (
        <div className="noid-card flex flex-col items-center gap-4 p-12 text-center">
          <p className="text-xs leading-loose tracking-[0.15em] text-white/40">
            EL CURSO AÚN NO TIENE CONTENIDO. USA "+ NUEVO MÓDULO" PARA CREAR UN
            MÓDULO CON SUS LECCIONES DE UNA VEZ.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragCancel={onDragCancel}
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
                  busy={mutating}
                  onRename={(t) =>
                    renameModule(mod.id, t)
                      .then(() =>
                        setModules((prev) =>
                          prev.map((m) => (m.id === mod.id ? { ...m, title: t } : m)),
                        ),
                      )
                      .catch(() => {
                        setError('No se pudo renombrar el módulo.')
                        // resync effect reverts the input to the saved title
                        setModules((prev) => [...prev])
                      })
                  }
                  onDuplicate={() => void onDuplicateModule(mod)}
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
                            busy={mutating}
                            onEdit={() => setEditing(lesson)}
                            onDuplicate={() => void onDuplicateLesson(lesson)}
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

      {showModuleEditor && (
        <ModuleEditor
          courseId={courseId}
          position={modules.length + 1}
          onClose={() => setShowModuleEditor(false)}
          onCreated={(module) => setModules((prev) => [...prev, module])}
        />
      )}

      {editing && (
        <LessonEditor
          lesson={editing}
          onClose={() => setEditing(null)}
          onSaved={(patch) =>
            setModules((prev) =>
              prev.map((m) => ({
                ...m,
                lessons: m.lessons.map((l) => (l.id === editing.id ? { ...l, ...patch } : l)),
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
