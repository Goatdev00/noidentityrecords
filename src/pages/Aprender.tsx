import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import LessonPlayer from '../components/learn/LessonPlayer'
import { useAuth } from '../lib/auth'
import { fetchCourseBySlug, fetchTemario, type CourseDetail } from '../lib/academia'
import {
  fetchCompleted,
  fetchLessonContent,
  flattenLessons,
  markComplete,
  markIncomplete,
  type LearnModule,
  type LessonContent,
} from '../lib/learn'
import { parseVideo } from '../lib/video'

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notfound' }
  | { status: 'notenrolled'; slug: string }
  | { status: 'ready'; course: CourseDetail; modules: LearnModule[] }

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
  const { session, loading: authLoading } = useAuth()
  const [params, setParams] = useSearchParams()

  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [content, setContent] = useState<LessonContent | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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
        const modules = (await fetchTemario(course.id)) as LearnModule[]
        const lessons = flattenLessons(modules)
        // enrollment is proven by being able to read progress OR content;
        // we check via a progress read (RLS returns rows only if enrolled,
        // but an empty set is ambiguous) — so probe the first lesson content
        const done = await fetchCompleted(lessons.map((l) => l.id))
        let enrolled = done.size > 0
        if (!enrolled && lessons.length > 0) {
          const probe = await fetchLessonContent(lessons[0].id)
          enrolled = probe !== null
        }
        if (!enrolled) {
          if (!cancelled) setLoad({ status: 'notenrolled', slug })
          return
        }
        if (!cancelled) {
          setCompleted(done)
          setLoad({ status: 'ready', course, modules })
        }
      } catch {
        if (!cancelled) setLoad({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, authLoading])

  const lessons = useMemo(
    () => (load.status === 'ready' ? flattenLessons(load.modules) : []),
    [load],
  )

  // current lesson: ?leccion= or first incomplete or first
  const currentId = useMemo(() => {
    if (lessons.length === 0) return null
    const requested = params.get('leccion')
    if (requested && lessons.some((l) => l.id === requested)) return requested
    const firstIncomplete = lessons.find((l) => !completed.has(l.id))
    return (firstIncomplete ?? lessons[0]).id
  }, [lessons, params, completed])

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
    fetchLessonContent(currentId)
      .then((c) => {
        if (!cancelled) setContent(c)
      })
      .catch(() => {
        if (!cancelled) setContent(null)
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentId])

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

  const setDone = useCallback(
    async (lessonId: string, done: boolean) => {
      // optimistic
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
    },
    [],
  )

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

  const { course, modules } = load
  const total = lessons.length
  const doneCount = lessons.filter((l) => completed.has(l.id)).length
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const isDone = current ? completed.has(current.id) : false
  const prev = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const next = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null
  const video = parseVideo(content?.video_url)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-8 md:flex-row md:gap-10 md:px-6 md:pt-12">
      {/* sidebar */}
      <aside className="flex shrink-0 flex-col gap-6 md:w-72">
        <div className="flex flex-col gap-3">
          <Link
            to={`/academia/${course.slug}`}
            className="text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
          >
            ← {course.title}
          </Link>
          <div className="flex flex-col gap-2">
            <div className="h-px w-full bg-white/10">
              <div className="h-px bg-accent transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/40">
              {progress}% · {doneCount}/{total} lecciones
            </p>
          </div>
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
                          <CheckIcon done={completed.has(lesson.id)} />
                          <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
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
      <main className="flex min-w-0 flex-1 flex-col gap-8">
        {progress === 100 && (
          <div className="noid-card flex flex-col items-center gap-4 p-8 text-center">
            <p className="noid-label">CURSO COMPLETADO</p>
            <p className="text-xs leading-loose tracking-[0.15em] text-white/50">
              TERMINASTE TODAS LAS LECCIONES. TU CERTIFICADO ESTARÁ DISPONIBLE MUY PRONTO.
            </p>
          </div>
        )}

        {current ? (
          <>
            {contentLoading ? (
              <div className="flex aspect-video w-full items-center justify-center bg-black" role="status">
                <p className="noid-label animate-pulse">CARGANDO</p>
              </div>
            ) : (
              <LessonPlayer
                video={video}
                lessonId={current.id}
                onEnded={() => {
                  if (!completed.has(current.id)) void setDone(current.id, true)
                }}
              />
            )}

            <div className="flex flex-col gap-4">
              <h1 className="noid-title text-lg leading-relaxed text-white md:text-xl">
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
              <button
                type="button"
                onClick={() => void setDone(current.id, !isDone)}
                disabled={saving}
                className={`self-start ${
                  isDone
                    ? 'px-6 py-4 font-display text-[11px] uppercase tracking-[0.3em] text-accent transition-colors hover:text-white'
                    : 'noid-button'
                } disabled:opacity-40`}
              >
                {isDone ? '✓ Completada — desmarcar' : 'Marcar como completada'}
              </button>

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
