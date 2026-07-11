import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../lib/auth'
import {
  createCourse,
  deleteCourse,
  fetchAllCourses,
  fetchMyCourses,
  setCoursePublished,
  type AdminCourse,
  type PanelCourse,
} from '../lib/panel'
import { formatCOP } from '../lib/format'

type Row = PanelCourse & { teacher?: { display_name: string | null } | null }

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; courses: Row[] }

/** /panel — a teacher's own courses; the super account sees and manages ALL
 *  courses on the platform (hide/unhide, delete), RLS-backed. */
export default function Panel() {
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null)
  const [error, setError] = useState<string | null>(null)

  const teacherId = session?.user.id
  const isSuper = profile?.is_super ?? false

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!teacherId || !profile) return
      try {
        const courses: Row[] = isSuper
          ? ((await fetchAllCourses()) as AdminCourse[])
          : await fetchMyCourses(teacherId)
        if (!cancelled) setState({ status: 'ready', courses })
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, isSuper, profile !== null])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!teacherId || !newTitle.trim()) return
    setCreating(true)
    setError(null)
    try {
      const course = await createCourse(teacherId, newTitle.trim())
      navigate(`/panel/curso/${course.id}`)
    } catch {
      setError('No se pudo crear el curso. Intenta de nuevo.')
      setCreating(false)
    }
  }

  const onTogglePublished = async (course: Row) => {
    setBusyId(course.id)
    setError(null)
    try {
      await setCoursePublished(course.id, !course.published)
      setState((prev) =>
        prev.status === 'ready'
          ? {
              status: 'ready',
              courses: prev.courses.map((c) =>
                c.id === course.id ? { ...c, published: !course.published } : c,
              ),
            }
          : prev,
      )
    } catch {
      setError('No se pudo cambiar la visibilidad.')
    } finally {
      setBusyId(null)
    }
  }

  const onDelete = async () => {
    const target = pendingDelete
    setPendingDelete(null)
    if (!target) return
    setBusyId(target.id)
    setError(null)
    try {
      await deleteCourse(target.id)
      setState((prev) =>
        prev.status === 'ready'
          ? { status: 'ready', courses: prev.courses.filter((c) => c.id !== target.id) }
          : prev,
      )
    } catch (err) {
      const fk =
        err !== null && typeof err === 'object' && 'code' in err &&
        (err as { code?: string }).code === '23503'
      setError(
        fk
          ? 'No se puede eliminar: el curso tiene estudiantes inscritos. Puedes ocultarlo del catálogo.'
          : 'No se pudo eliminar el curso.',
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-14 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col gap-4">
        <p className="noid-label">PANEL DE MAESTRO</p>
        <h1 className="noid-title text-lg leading-relaxed text-white md:text-2xl">
          {isSuper ? 'TODOS LOS CURSOS' : 'TUS CURSOS'}
        </h1>
        {isSuper && (
          <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
            Modo superusuario · ves y gestionas los cursos de todos los maestros
          </p>
        )}
      </header>

      <form onSubmit={onCreate} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="TÍTULO DEL NUEVO CURSO"
          aria-label="Título del nuevo curso"
          className="min-w-0 flex-1 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.1em] text-white placeholder:text-white/25 transition-colors duration-300 focus:border-white/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={creating || !newTitle.trim()}
          className="noid-button disabled:opacity-40"
        >
          Crear curso
        </button>
      </form>
      {error && (
        <p role="alert" className="-mt-8 text-xs tracking-[0.1em] text-accent">
          {error}
        </p>
      )}

      {state.status === 'loading' && (
        <div className="flex min-h-[20vh] items-center justify-center" role="status">
          <p className="noid-label animate-pulse">CARGANDO</p>
        </div>
      )}

      {state.status === 'error' && (
        <p role="alert" className="text-xs leading-loose tracking-[0.15em] text-white/60">
          NO PUDIMOS CARGAR LOS CURSOS. RECARGA LA PÁGINA.
        </p>
      )}

      {state.status === 'ready' &&
        (state.courses.length === 0 ? (
          <div className="noid-card flex flex-col items-center gap-4 p-12 text-center">
            <p className="text-xs leading-loose tracking-[0.15em] text-white/60">
              AÚN NO HAY CURSOS. CREA EL PRIMERO ARRIBA: SOLO NECESITAS UN
              TÍTULO PARA EMPEZAR.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {state.courses.map((c) => (
              <li
                key={c.id}
                className="noid-card flex flex-wrap items-center justify-between gap-4 px-6 py-5"
              >
                <Link to={`/panel/curso/${c.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-display text-[12px] uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-70">
                    {c.title}
                  </p>
                  <p className="mt-1 text-[10px] tracking-[0.2em] text-white/40">
                    {formatCOP(c.price_cop)}
                    {isSuper && c.teacher?.display_name && (
                      <span className="ml-3 text-white/30">· {c.teacher.display_name}</span>
                    )}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-4">
                  <span
                    className={`border px-3 py-1 text-[9px] uppercase tracking-[0.3em] ${
                      c.published
                        ? 'border-accent/40 text-accent'
                        : 'border-white/15 text-white/40'
                    }`}
                  >
                    {c.published ? 'Publicado' : 'Oculto'}
                  </span>
                  {isSuper && (
                    <>
                      <button
                        type="button"
                        onClick={() => void onTogglePublished(c)}
                        disabled={busyId === c.id}
                        className="text-[9px] uppercase tracking-[0.25em] text-white/40 transition-colors hover:text-white disabled:opacity-40"
                      >
                        {c.published ? 'Ocultar' : 'Publicar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(c)}
                        disabled={busyId === c.id}
                        className="text-[9px] uppercase tracking-[0.25em] text-white/30 transition-colors hover:text-accent disabled:opacity-40"
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="ELIMINAR CURSO"
        copy={`SE ELIMINARÁ "${pendingDelete?.title}" CON TODOS SUS MÓDULOS Y LECCIONES. ESTA ACCIÓN NO SE PUEDE DESHACER.`}
        confirmLabel="Eliminar"
        onConfirm={() => void onDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
