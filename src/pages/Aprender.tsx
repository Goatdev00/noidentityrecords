import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import LessonPlayer from '../components/learn/LessonPlayer'
import { useAuth } from '../lib/auth'
import { fetchCourseBySlug, fetchTemario, type CourseDetail } from '../lib/academia'
import {
  fetchCompleted,
  fetchLessonContent,
  flattenLessons,
  isEnrolled,
  markComplete,
  markIncomplete,
  type LearnModule,
  type LessonContent,
} from '../lib/learn'
import { parseVideo } from '../lib/video'
import { issueCertificate } from '../lib/certificates'

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notfound' }
  | { status: 'notenrolled'; slug: string }
  | { status: 'ready'; course: CourseDetail; modules: LearnModule[]; preview: boolean }

function CheckIcon({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[8px] ${
        done ? 'border-accent bg-accent text-black' : 'border-white/25 text-transparent'
      }`}
    >
      ✓
    </span>
  )
}

export default function Aprender() {
  const { slug } = useParams<{ slug: string }>()
  const { session, profile, loading: authLoading } = useAuth()
  const [params, setParams] = useSearchParams()

  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [content, setContent] = useState<LessonContent | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [certBusy, setCertBusy] = useState(false)
  const [certError, setCertError] = useState<string | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  // ── load course + temario + enrollment + progress ──
  useEffect(() => {
    if (authLoading) return
    if (!slug) return
    let cancelled = false
    setLoad({ status: 'loading' })
    ;(async () => {
      try {
        const course = await fetchCourseBySlug(slug)
        if (!course) {
          if (!cancelled) setLoad({ status: 'notfound' })
          return
        }
        // direct enrollment check (not inferred from content, which would
        // wrongly redirect if the first lesson has no video row yet)
        const enrolledFlag = await isEnrolled(course.id)
        // the course owner (and admin) can always see their own content —
        // RLS already allows it — so they skip the enrollment gate
        const owner =
          course.teacher_id === session?.user.id || profile?.role === 'admin'
        if (!enrolledFlag && !owner) {
          if (!cancelled) setLoad({ status: 'notenrolled', slug })
          return
        }
        // owner/admin viewing without a real enrollment = preview (no progress)
        const preview = owner && !enrolledFlag
        const modules = (await fetchTemario(course.id)) as LearnModule[]
        const lessons = flattenLessons(modules)
        const done = preview ? new Set<string>() : await fetchCompleted(lessons.map((l) => l.id))
        if (!cancelled) {
          setCompleted(done)
          setLoad({ status: 'ready', course, modules, preview })
        }
      } catch {
        if (!cancelled) setLoad({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
    // re-evaluate access once the profile (admin role) / session resolve
  }, [slug, authLoading, session?.user.id, profile?.role])

  useEffect(() => {
    if (load.status === 'ready') {
      document.title = `${load.course.title} — NO.ID RECORDS`
    }
  }, [load])

  const lessons = useMemo(
    () => (load.status === 'ready' ? flattenLessons(load.modules) : []),
    [load],
  )

  const requestedId = params.get('leccion')
  const firstIncompleteId = useMemo(() => {
    const l = lessons.find((x) => !completed.has(x.id))
    return (l ?? lessons[0])?.id ?? null
  }, [lessons, completed])

  // pin the resolved lesson into the URL once, so marking a lesson complete
  // (which changes `completed`) never moves the player out from under the user
  useEffect(() => {
    if (load.status !== 'ready' || lessons.length === 0) return
    if (requestedId && lessons.some((l) => l.id === requestedId)) return
    if (!firstIncompleteId) return
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('leccion', firstIncompleteId)
        return next
      },
      { replace: true },
    )
    // firstIncompleteId is only read for the initial pin; the guard above
    // stops any re-pin once a valid param exists
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.status, lessons, requestedId])

  const currentId =
    requestedId && lessons.some((l) => l.id === requestedId)
      ? requestedId
      : firstIncompleteId

  const currentIndex = useMemo(
    () => lessons.findIndex((l) => l.id === currentId),
    [lessons, currentId],
  )
  const current = currentIndex >= 0 ? lessons[currentIndex] : null

  // ── load current lesson content ──
  useEffect(() => {
    if (!currentId) return
    let cancelled = false
    setContentLoading(true)
    setContent(null)
    setContentError(false)
    fetchLessonContent(currentId)
      .then((c) => {
        if (!cancelled) setContent(c)
      })
      .catch(() => {
        // a fetch failure is NOT the same as "no video set yet"
        if (!cancelled) setContentError(true)
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentId, retryKey])

  // move focus to the lesson title on change so AT announces the new lesson
  useEffect(() => {
    if (!contentLoading && current) titleRef.current?.focus()
  }, [currentId, contentLoading, current])

  const goTo = useCallback(
    (lessonId: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('leccion', lessonId)
        return next
      })
    },
    [setParams],
  )

  const setDone = useCallback(async (lessonId: string, done: boolean) => {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (done) next.add(lessonId)
      else next.delete(lessonId)
      return next
    })
    setSaving(true)
    try {
      if (done) await markComplete(lessonId)
      else await markIncomplete(lessonId)
    } catch {
      // revert on failure
      setCompleted((prev) => {
        const next = new Set(prev)
        if (done) next.delete(lessonId)
        else next.add(lessonId)
        return next
      })
    } finally {
      setSaving(false)
    }
  }, [])

  if (authLoading || load.status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status">
        <p className="noid-label animate-pulse">CARGANDO</p>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace state={{ from: `/academia/${slug}/aprender` }} />
  if (load.status === 'notfound') {
    return <EmptyState label="ACADEMIA" title="ESTE CURSO NO EXISTE" copy="EL CURSO QUE BUSCAS NO ESTÁ DISPONIBLE." />
  }
  if (load.status === 'error') {
    return <EmptyState label="ACADEMIA" title="ALGO SALIÓ MAL" copy="NO PUDIMOS CARGAR EL CURSO. REVISA TU CONEXIÓN E INTENTA DE NUEVO." />
  }
  if (load.status === 'notenrolled') {
    return <Navigate to={`/academia/${load.slug}`} replace />
  }

  const { course, modules, preview } = load
  const total = lessons.length
  const doneCount = lessons.filter((l) => completed.has(l.id)).length
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const isDone = current ? completed.has(current.id) : false
  const prev = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const next = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null
  const video = parseVideo(content?.video_url)
  // an incomplete lesson that isn't the one we're already on
  const continueTarget =
    firstIncompleteId && firstIncompleteId !== currentId ? firstIncompleteId : null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-8 md:flex-row md:gap-10 md:px-6 md:pt-12">
      {/* sidebar — below the player on mobile, left on desktop */}
      <aside className="order-2 flex shrink-0 flex-col gap-6 md:order-1 md:w-72">
        <div className="flex flex-col gap-3">
          <Link
            to={`/academia/${course.slug}`}
            className="text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
          >
            ← {course.title}
          </Link>
          {preview ? (
            <p className="text-[9px] uppercase tracking-[0.3em] text-accent">
              Vista de maestro
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div
                className="h-px w-full bg-white/10"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progreso del curso"
              >
                <div className="h-px bg-accent transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-white/60">
                {progress}% · {doneCount}/{total} lecciones
              </p>
            </div>
          )}
        </div>

        <nav aria-label="Temario" className="flex flex-col gap-6">
          {modules.map((mod, mi) => (
            <div key={mod.id} className="flex flex-col gap-2">
              <p className="font-display text-[9px] uppercase tracking-[0.25em] text-white/30">
                {String(mi + 1).padStart(2, '0')} · {mod.title}
              </p>
              <ul className="flex flex-col">
                {[...mod.lessons]
                  .sort((a, b) => a.position - b.position)
                  .map((lesson) => {
                    const active = lesson.id === currentId
                    const lessonDone = completed.has(lesson.id)
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          onClick={() => goTo(lesson.id)}
                          aria-current={active ? 'true' : undefined}
                          className={`flex w-full items-center gap-3 py-2 text-left text-[11px] tracking-[0.05em] transition-colors ${
                            active ? 'text-white' : 'text-white/45 hover:text-white/80'
                          }`}
                        >
                          <CheckIcon done={lessonDone} />
                          <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                          <span className="sr-only">
                            {lessonDone ? '(completada)' : '(pendiente)'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* main */}
      <main className="order-1 flex min-w-0 flex-1 flex-col gap-8 md:order-2">
        {preview && (
          <div className="noid-card flex flex-col items-center gap-2 p-5 text-center">
            <p className="noid-label text-accent">VISTA DE MAESTRO</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
              Estás previsualizando tu curso. Aquí el progreso no se guarda.
            </p>
          </div>
        )}
        {progress === 100 && !preview && (
          <div className="noid-card flex flex-col items-center gap-5 p-8 text-center">
            <p className="noid-label">CURSO COMPLETADO</p>
            <p className="text-xs leading-loose tracking-[0.15em] text-white/50">
              TERMINASTE TODAS LAS LECCIONES. GENERA TU CERTIFICADO Y RECÍBELO EN TU CORREO.
            </p>
            <button
              type="button"
              disabled={certBusy}
              onClick={async () => {
                setCertBusy(true)
                setCertError(null)
                // pre-open the tab in the gesture so it isn't pop-up-blocked
                const win = window.open('about:blank', '_blank')
                try {
                  const { signed_url } = await issueCertificate(course.id)
                  if (signed_url) {
                    if (win) win.location.href = signed_url
                    else window.location.assign(signed_url)
                  } else {
                    win?.close()
                  }
                } catch (e) {
                  win?.close()
                  setCertError(e instanceof Error ? e.message : 'No se pudo generar el certificado.')
                } finally {
                  setCertBusy(false)
                }
              }}
              className="noid-button disabled:opacity-40"
            >
              {certBusy ? 'Generando…' : 'Generar mi certificado'}
            </button>
            {certError && (
              <p role="alert" className="text-xs tracking-[0.1em] text-accent">
                {certError}
              </p>
            )}
          </div>
        )}

        {current ? (
          <>
            {contentLoading ? (
              <div className="flex aspect-video w-full items-center justify-center bg-black" role="status">
                <p className="noid-label animate-pulse">CARGANDO</p>
              </div>
            ) : contentError ? (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 border border-white/10 bg-black text-center">
                <p role="alert" className="px-6 text-xs leading-loose tracking-[0.15em] text-white/60">
                  NO PUDIMOS CARGAR ESTA LECCIÓN.
                </p>
                <button
                  type="button"
                  onClick={() => setRetryKey((k) => k + 1)}
                  className="text-[10px] uppercase tracking-[0.3em] text-accent transition-opacity hover:opacity-70"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <LessonPlayer
                video={video}
                lessonId={current.id}
                onEnded={() => {
                  if (!preview && !completed.has(current.id)) void setDone(current.id, true)
                }}
              />
            )}

            <div aria-live="polite" className="flex flex-col gap-4">
              <h1
                ref={titleRef}
                tabIndex={-1}
                className="noid-title text-lg leading-relaxed text-white outline-none md:text-xl"
              >
                {current.title}
              </h1>
              {current.subtitle && (
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">{current.subtitle}</p>
              )}
              {current.description && (
                <p className="whitespace-pre-line text-sm leading-loose tracking-[0.05em] text-white/60">
                  {current.description}
                </p>
              )}
            </div>

            {content && content.links.length > 0 && (
              <section aria-label="Links de la lección" className="flex flex-col gap-3">
                <h2 className="noid-label">RECURSOS</h2>
                <ul className="flex flex-col gap-2">
                  {content.links.map((link, i) => (
                    <li key={i}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] uppercase tracking-[0.2em] text-accent transition-opacity hover:opacity-70"
                      >
                        {link.label} →
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* controls */}
            <div className="flex flex-col gap-6 border-t border-white/5 pt-8">
              <div className="flex flex-wrap items-center gap-4">
                {!preview && (
                  <button
                    type="button"
                    onClick={() => void setDone(current.id, !isDone)}
                    disabled={saving}
                    aria-pressed={isDone}
                    className={`${
                      isDone
                        ? 'px-6 py-4 font-display text-[11px] uppercase tracking-[0.3em] text-accent transition-colors hover:text-white'
                        : 'noid-button'
                    } disabled:opacity-40`}
                  >
                    {isDone ? '✓ Completada — desmarcar' : 'Marcar como completada'}
                  </button>
                )}
                {continueTarget && (
                  <button
                    type="button"
                    onClick={() => goTo(continueTarget)}
                    className="px-6 py-4 font-display text-[11px] uppercase tracking-[0.3em] text-white/50 transition-colors hover:text-white"
                  >
                    Continuar →
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                {prev ? (
                  <button
                    type="button"
                    onClick={() => goTo(prev.id)}
                    className="text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
                  >
                    ← Anterior
                  </button>
                ) : (
                  <span />
                )}
                {next ? (
                  <button
                    type="button"
                    onClick={() => goTo(next.id)}
                    className="text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
                  >
                    Siguiente →
                  </button>
                ) : (
                  <span />
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs leading-loose tracking-[0.15em] text-white/40">
            ESTE CURSO AÚN NO TIENE LECCIONES.
          </p>
        )}
      </main>
    </div>
  )
}
