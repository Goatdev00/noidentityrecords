import { useEffect, useRef, useState, type FormEvent } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import {
  fetchLessonContent,
  saveLessonContent,
  updateLesson,
  type LessonLink,
  type PanelLesson,
} from '../../lib/panel'

const inputClass =
  'w-full min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.1em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const labelClass = 'text-[10px] uppercase tracking-[0.3em] text-white/40'

type Props = {
  lesson: PanelLesson
  onClose: () => void
  onSaved: (patch: Pick<PanelLesson, 'title' | 'subtitle' | 'description'>) => void
}

type Snapshot = {
  title: string
  subtitle: string
  description: string
  videoUrl: string
  links: string
}

/**
 * Full-screen sober editor for one lesson: metadata + video link + extra
 * links. Video is ALWAYS an external link (YouTube/Vimeo) — no file uploads,
 * ever (brief rule). Traps focus, restores it on close, and asks before
 * discarding unsaved edits.
 */
export default function LessonEditor({ lesson, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(lesson.title)
  const [subtitle, setSubtitle] = useState(lesson.subtitle ?? '')
  const [description, setDescription] = useState(lesson.description ?? '')
  const [videoUrl, setVideoUrl] = useState('')
  const [links, setLinks] = useState<LessonLink[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const baseline = useRef<Snapshot | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchLessonContent(lesson.id)
      .then((c) => {
        if (cancelled) return
        setVideoUrl(c.video_url ?? '')
        setLinks(c.links)
        baseline.current = {
          title: lesson.title,
          subtitle: lesson.subtitle ?? '',
          description: lesson.description ?? '',
          videoUrl: c.video_url ?? '',
          links: JSON.stringify(c.links),
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError('No se pudo cargar el contenido de la lección.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [lesson.id, lesson.title, lesson.subtitle, lesson.description])

  const isDirty = () => {
    const b = baseline.current
    if (!b) return false
    return (
      title !== b.title ||
      subtitle !== b.subtitle ||
      description !== b.description ||
      videoUrl !== b.videoUrl ||
      JSON.stringify(links) !== b.links
    )
  }

  const requestClose = () => {
    if (isDirty()) setConfirmDiscard(true)
    else onClose()
  }

  // focus: into the dialog on open, trapped while open, back to opener after
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    return () => opener?.focus()
  }, [])

  useEffect(() => {
    if (!loading) titleRef.current?.focus()
  }, [loading])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // let a nested confirm dialog own Escape while it's open
        if (!confirmDiscard) requestClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current || confirmDiscard) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
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

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const patch = {
        title: title.trim() || 'Lección sin título',
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
      }
      await updateLesson(lesson.id, patch)
      await saveLessonContent(lesson.id, {
        video_url: videoUrl.trim() || null,
        links: links.filter((l) => l.label.trim() && l.url.trim()),
      })
      onSaved(patch)
      onClose()
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
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
        aria-label={`Editar lección: ${lesson.title}`}
        className="mx-auto my-10 w-full max-w-2xl border border-white/10 bg-black p-8 md:p-10"
      >
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 className="noid-title text-sm text-white">EDITAR LECCIÓN</h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar editor"
            className="p-2 text-white/40 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p role="status" className="noid-label animate-pulse py-10 text-center">
            CARGANDO
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="l-title" className={labelClass}>
                Título
              </label>
              <input
                id="l-title"
                ref={titleRef}
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="l-subtitle" className={labelClass}>
                Subtítulo
              </label>
              <input
                id="l-subtitle"
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="l-description" className={labelClass}>
                Descripción
              </label>
              <textarea
                id="l-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="l-video" className={labelClass}>
                Link del video (YouTube o Vimeo)
              </label>
              <input
                id="l-video"
                type="url"
                placeholder="https://youtu.be/…"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className={inputClass}
              />
              <p className="text-[9px] leading-relaxed tracking-[0.15em] text-white/30">
                EL VIDEO SIEMPRE VA POR LINK EXTERNO. SOLO LOS INSCRITOS PODRÁN VERLO.
              </p>
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className={labelClass}>Links de la lección</legend>
              {links.map((link, i) => (
                <div key={i} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    aria-label={`Etiqueta del link ${i + 1}`}
                    placeholder="ETIQUETA"
                    value={link.label}
                    onChange={(e) =>
                      setLinks(links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))
                    }
                    className={`${inputClass} sm:w-40`}
                  />
                  <input
                    type="url"
                    aria-label={`URL del link ${i + 1}`}
                    placeholder="https://…"
                    value={link.url}
                    onChange={(e) =>
                      setLinks(links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))
                    }
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => setLinks(links.filter((_, j) => j !== i))}
                    aria-label={`Eliminar link ${i + 1}`}
                    className="px-3 py-2 text-white/40 transition-colors hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLinks([...links, { label: '', url: '' }])}
                className="self-start text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
              >
                + Agregar link
              </button>
            </fieldset>

            {error && (
              <p role="alert" className="text-xs tracking-[0.1em] text-accent">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-4 pt-2">
              <button
                type="button"
                onClick={requestClose}
                className="px-6 py-4 font-display text-[11px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
              >
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="noid-button disabled:opacity-40">
                Guardar
              </button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="DESCARTAR CAMBIOS"
        copy="TIENES CAMBIOS SIN GUARDAR. SI SALES AHORA, SE PERDERÁN."
        confirmLabel="Salir sin guardar"
        onConfirm={onClose}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  )
}
