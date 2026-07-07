import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import {
  fetchCourseBySlug,
  fetchEnrollmentStatus,
  fetchTemario,
  type CourseDetail,
  type EnrollmentStatus,
  type ModuleWithLessons,
} from '../lib/academia'
import { formatCOP } from '../lib/format'
import { useAuth } from '../lib/auth'

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="5" y="11" width="14" height="9" rx="1" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notfound' }
  | { status: 'ready'; course: CourseDetail; temario: ModuleWithLessons[] }

export default function Curso() {
  const { slug } = useParams<{ slug: string }>()
  const { session, profile, loading: authLoading } = useAuth()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [enrollment, setEnrollment] = useState<EnrollmentStatus | null>(null)
  const [enrollmentError, setEnrollmentError] = useState(false)
  const [buyNotice, setBuyNotice] = useState(false)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setState({ status: 'loading' })
    fetchCourseBySlug(slug)
      .then(async (course) => {
        if (!course) {
          if (!cancelled) setState({ status: 'notfound' })
          return
        }
        const temario = await fetchTemario(course.id)
        if (!cancelled) setState({ status: 'ready', course, temario })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const lessonIds = useMemo(
    () =>
      state.status === 'ready'
        ? state.temario.flatMap((m) => m.lessons.map((l) => l.id))
        : [],
    [state],
  )

  useEffect(() => {
    if (state.status !== 'ready' || authLoading) return
    if (!session) {
      setEnrollment(null)
      setEnrollmentError(false)
      return
    }
    let cancelled = false
    setEnrollmentError(false)
    fetchEnrollmentStatus(state.course.id, lessonIds)
      .then((e) => {
        if (!cancelled) setEnrollment(e)
      })
      .catch(() => {
        // distinguish "couldn't verify" from "not enrolled" so we don't
        // wrongly show "Comprar" to someone who already owns the course
        if (!cancelled) {
          setEnrollment(null)
          setEnrollmentError(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [state, session, authLoading, lessonIds])

  useEffect(() => {
    if (state.status === 'ready') {
      document.title = `${state.course.title} — NO.ID RECORDS`
    }
  }, [state])

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status">
        <p className="noid-label animate-pulse">CARGANDO</p>
      </div>
    )
  }

  if (state.status === 'notfound') {
    return (
      <EmptyState
        label="ACADEMIA"
        title="ESTE CURSO NO EXISTE"
        copy="EL CURSO QUE BUSCAS NO ESTÁ DISPONIBLE O FUE RETIRADO."
      />
    )
  }

  if (state.status === 'error') {
    return (
      <EmptyState
        label="ACADEMIA"
        title="ALGO SALIÓ MAL"
        copy="NO PUDIMOS CARGAR EL CURSO. REVISA TU CONEXIÓN E INTENTA DE NUEVO."
      />
    )
  }

  const { course, temario } = state
  const enrolled = enrollment?.enrolled ?? false
  // the owner (and admin) can always view their own content, even in the
  // student preview — so the temario is unlocked and they can enter the course
  const isOwner = course.teacher_id === session?.user.id || profile?.role === 'admin'
  const canView = enrolled || isOwner
  const lessonCount = lessonIds.length

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-20 px-6 pb-28 pt-12 md:pt-20">
      {/* hero — original academy-container treatment */}
      <section className="relative flex min-h-[380px] items-end overflow-hidden rounded-[4px] bg-black md:min-h-[450px]">
        {course.cover_url ? (
          <img
            src={course.cover_url}
            alt=""
            className="absolute inset-0 z-[1] h-full w-full object-cover brightness-[0.4]"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 z-[1] flex items-center justify-center border border-white/5"
          >
            <img src="/logo-noid-wordmark.png" alt="" className="w-40 opacity-10" />
          </div>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black via-black/70 to-transparent"
        />
        <div className="relative z-10 flex w-full flex-col gap-6 px-6 py-10 md:px-10 md:py-12">
          <p className="noid-label">ACADEMIA</p>
          <h1 className="noid-title max-w-3xl text-2xl leading-tight text-white [text-shadow:0_4px_15px_rgba(0,0,0,1)] md:text-4xl">
            {course.title}
            {course.subtitle && (
              <span className="mt-1 block text-xl italic text-white/60 md:text-2xl">
                {course.subtitle}
              </span>
            )}
          </h1>
          {course.teacher?.display_name && (
            <div className="flex items-center gap-3">
              {course.teacher.avatar_url && (
                <img
                  src={course.teacher.avatar_url}
                  alt=""
                  className="h-8 w-8 rounded-full border border-white/20 object-cover"
                />
              )}
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                Un curso de {course.teacher.display_name}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* price + CTA */}
      <section className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
        <div>
          <p className="text-3xl font-light tracking-widest md:text-5xl">
            {formatCOP(course.price_cop)}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-white/50">
            Acceso permanente · {lessonCount} lecciones
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          {isOwner && !enrolled ? (
            <>
              <Link to={`/academia/${course.slug}/aprender`} className="noid-button">
                Entrar al curso
              </Link>
              <p className="text-[9px] uppercase tracking-[0.3em] text-white/60">
                Vista de maestro · contenido desbloqueado
              </p>
            </>
          ) : enrolled ? (
            <>
              <Link to={`/academia/${course.slug}/aprender`} className="noid-button">
                Continuar
              </Link>
              <div className="flex w-56 flex-col gap-2">
                <div className="h-px w-full bg-white/10">
                  <div
                    className="h-px bg-accent transition-all duration-700"
                    style={{ width: `${enrollment?.progress ?? 0}%` }}
                  />
                </div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-white/60">
                  {enrollment?.progress ?? 0}% completado
                </p>
              </div>
            </>
          ) : session && enrollmentError ? (
            <p role="alert" className="text-[10px] uppercase tracking-[0.25em] text-white/60">
              No pudimos verificar tu acceso. Recarga la página.
            </p>
          ) : session ? (
            <>
              <button
                type="button"
                className="noid-button"
                onClick={() => setBuyNotice(true)}
              >
                Comprar curso
              </button>
              <p role="status" className="text-[9px] uppercase tracking-[0.3em] text-white/60">
                {buyNotice ? 'LOS PAGOS SE HABILITAN MUY PRONTO.' : ''}
              </p>
            </>
          ) : (
            <>
              <Link
                to="/login"
                state={{ from: `/academia/${course.slug}` }}
                className="noid-button"
              >
                Comprar curso
              </Link>
              <p className="text-[9px] uppercase tracking-[0.3em] text-white/60">
                NECESITAS UNA CUENTA PARA COMPRAR
              </p>
            </>
          )}
        </div>
      </section>

      {course.description && (
        <section aria-label="Descripción" className="max-w-3xl">
          <p className="whitespace-pre-line text-sm leading-loose tracking-[0.05em] text-white/60">
            {course.description}
          </p>
        </section>
      )}

      {/* temario — always visible, content locked */}
      <section aria-label="Temario" className="flex flex-col gap-10">
        <h2 className="noid-label pl-2">TEMARIO</h2>
        {temario.length === 0 ? (
          <p className="text-xs leading-loose tracking-[0.15em] text-white/60">
            EL TEMARIO SE PUBLICARÁ PRONTO.
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            {temario.map((mod, mi) => (
              <div key={mod.id} className="noid-card">
                <header className="border-b border-white/5 px-6 py-4">
                  <h3 className="font-display text-[11px] uppercase tracking-[0.25em] text-white">
                    <span className="mr-3 text-white/30">
                      {String(mi + 1).padStart(2, '0')}
                    </span>
                    {mod.title}
                  </h3>
                </header>
                <ul>
                  {mod.lessons
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((lesson, li) => (
                      <li
                        key={lesson.id}
                        className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs tracking-[0.1em] text-white/70">
                            <span className="mr-3 text-white/25">
                              {String(li + 1).padStart(2, '0')}
                            </span>
                            {lesson.title}
                          </p>
                          {lesson.subtitle && (
                            <p className="mt-1 truncate pl-8 text-[10px] tracking-[0.1em] text-white/30">
                              {lesson.subtitle}
                            </p>
                          )}
                        </div>
                        {!canView && (
                          <span className="text-white/25" title="Contenido bloqueado">
                            <LockIcon />
                            <span className="sr-only">Contenido bloqueado</span>
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
