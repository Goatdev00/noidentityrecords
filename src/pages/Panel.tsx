import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { createCourse, fetchMyCourses, type PanelCourse } from '../lib/panel'
import { formatCOP } from '../lib/format'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; courses: PanelCourse[] }

/** /panel — the teacher's course list. Each teacher only sees their own
 *  courses (RLS enforced; the UI just doesn't have to think about it). */
export default function Panel() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const teacherId = session?.user.id

  useEffect(() => {
    if (!teacherId) return
    let cancelled = false
    fetchMyCourses(teacherId)
      .then((courses) => {
        if (!cancelled) setState({ status: 'ready', courses })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [teacherId])

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-14 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col gap-4">
        <p className="noid-label">PANEL DE MAESTRO</p>
        <h1 className="noid-title text-lg leading-relaxed text-white md:text-2xl">
          TUS CURSOS
        </h1>
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
          NO PUDIMOS CARGAR TUS CURSOS. RECARGA LA PÁGINA.
        </p>
      )}

      {state.status === 'ready' &&
        (state.courses.length === 0 ? (
          <div className="noid-card flex flex-col items-center gap-4 p-12 text-center">
            <p className="text-xs leading-loose tracking-[0.15em] text-white/60">
              AÚN NO TIENES CURSOS. CREA EL PRIMERO ARRIBA: SOLO NECESITAS UN
              TÍTULO PARA EMPEZAR.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {state.courses.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/panel/curso/${c.id}`}
                  className="noid-card flex items-center justify-between gap-4 px-6 py-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-[12px] uppercase tracking-[0.2em] text-white">
                      {c.title}
                    </p>
                    <p className="mt-1 text-[10px] tracking-[0.2em] text-white/40">
                      {formatCOP(c.price_cop)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 border px-3 py-1 text-[9px] uppercase tracking-[0.3em] ${
                      c.published
                        ? 'border-accent/40 text-accent'
                        : 'border-white/15 text-white/40'
                    }`}
                  >
                    {c.published ? 'Publicado' : 'Borrador'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
