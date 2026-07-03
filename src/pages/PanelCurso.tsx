import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import ContentEditor from '../components/panel/ContentEditor'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../lib/auth'
import { formatCOP } from '../lib/format'
import {
  deleteCourse,
  fetchContent,
  fetchMyCourse,
  slugify,
  updateCourse,
  uploadCover,
  type PanelCourse,
  type PanelModule,
} from '../lib/panel'

const inputClass =
  'w-full min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.1em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const labelClass = 'text-[10px] uppercase tracking-[0.3em] text-white/40'

type State =
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'ready'; course: PanelCourse }

export default function PanelCurso() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [state, setState] = useState<State>({ status: 'loading' })
  const [modules, setModules] = useState<PanelModule[]>([])
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    if (!id) return
    const course = await fetchMyCourse(id)
    if (!course) {
      setState({ status: 'notfound' })
      return
    }
    setState({ status: 'ready', course })
    setTitle(course.title)
    setSubtitle(course.subtitle ?? '')
    setSlug(course.slug)
    setDescription(course.description ?? '')
    setPrice(String(course.price_cop))
    setModules(await fetchContent(course.id))
  }

  useEffect(() => {
    load().catch(() => setState({ status: 'notfound' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
        label="PANEL DE MAESTRO"
        title="CURSO NO ENCONTRADO"
        copy="ESTE CURSO NO EXISTE O NO TE PERTENECE."
      />
    )
  }

  const { course } = state

  const saveInfo = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    setError(null)
    const priceNum = Math.round(Number(price))
    if (!Number.isFinite(priceNum) || priceNum < 1000) {
      setError('El precio mínimo es 1.000 COP (sin decimales).')
      setSaving(false)
      return
    }
    try {
      const cleanSlug = slugify(slug || title)
      await updateCourse(course.id, {
        title: title.trim() || course.title,
        subtitle: subtitle.trim() || null,
        slug: cleanSlug,
        description: description.trim() || null,
        price_cop: priceNum,
      })
      setSlug(cleanSlug)
      setNotice('GUARDADO.')
      setState({
        status: 'ready',
        course: {
          ...course,
          title: title.trim() || course.title,
          subtitle: subtitle.trim() || null,
          slug: cleanSlug,
          description: description.trim() || null,
          price_cop: priceNum,
        },
      })
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes('duplicate')
          ? 'Ese slug ya está en uso por otro curso.'
          : 'No se pudo guardar. Intenta de nuevo.',
      )
    } finally {
      setSaving(false)
    }
  }

  const onCover = async (file: File) => {
    if (!session) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadCover(session.user.id, course.id, file)
      await updateCourse(course.id, { cover_url: url })
      setState({ status: 'ready', course: { ...course, cover_url: url } })
    } catch {
      setError('No se pudo subir la portada.')
    } finally {
      setUploading(false)
    }
  }

  const togglePublish = async () => {
    setError(null)
    setNotice(null)
    try {
      await updateCourse(course.id, { published: !course.published })
      setState({ status: 'ready', course: { ...course, published: !course.published } })
      setNotice(course.published ? 'CURSO DESPUBLICADO.' : 'CURSO PUBLICADO EN EL CATÁLOGO.')
    } catch {
      setError('No se pudo cambiar el estado de publicación.')
    }
  }

  const onDelete = async () => {
    try {
      await deleteCourse(course.id)
      navigate('/panel')
    } catch {
      setConfirmDelete(false)
      setError('No se pudo eliminar el curso.')
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-16 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col gap-6">
        <Link
          to="/panel"
          className="text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
        >
          ← Tus cursos
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="noid-title min-w-0 flex-1 truncate text-lg leading-relaxed text-white md:text-2xl">
            {course.title}
          </h1>
          <span
            className={`shrink-0 border px-3 py-1 text-[9px] uppercase tracking-[0.3em] ${
              course.published ? 'border-accent/40 text-accent' : 'border-white/15 text-white/40'
            }`}
          >
            {course.published ? 'Publicado' : 'Borrador'}
          </span>
        </div>
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => void togglePublish()} className="noid-button">
            {course.published ? 'Despublicar' : 'Publicar'}
          </button>
          <Link
            to={`/academia/${course.slug}`}
            className="px-6 py-4 font-display text-[11px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
          >
            Ver como estudiante
          </Link>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="px-6 py-4 font-display text-[11px] uppercase tracking-[0.3em] text-white/30 transition-colors hover:text-accent"
          >
            Eliminar curso
          </button>
        </div>
      </header>

      {/* course info */}
      <section aria-label="Información del curso" className="flex flex-col gap-8">
        <h2 className="noid-label">INFORMACIÓN</h2>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="group relative flex min-h-[200px] w-full items-center justify-center overflow-hidden rounded-[4px] border border-white/10 transition-colors hover:border-white/30"
          aria-label="Cambiar imagen de cabecera"
        >
          {course.cover_url ? (
            <img
              src={course.cover_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover brightness-[0.5]"
            />
          ) : null}
          <span className="relative z-10 text-[10px] uppercase tracking-[0.3em] text-white/50 transition-colors group-hover:text-white">
            {uploading ? 'SUBIENDO…' : course.cover_url ? 'CAMBIAR PORTADA' : 'SUBIR PORTADA'}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onCover(f)
            e.target.value = ''
          }}
        />

        <form onSubmit={saveInfo} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="c-title" className={labelClass}>
              Título
            </label>
            <input
              id="c-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="c-subtitle" className={labelClass}>
              Subtítulo
            </label>
            <input
              id="c-subtitle"
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="X EL MAMU"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="c-slug" className={labelClass}>
              Slug (URL)
            </label>
            <input
              id="c-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={inputClass}
            />
            <p className="text-[9px] tracking-[0.15em] text-white/30">
              noidentityrecords.com/academia/{slugify(slug || title) || '…'}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="c-description" className={labelClass}>
              Descripción
            </label>
            <textarea
              id="c-description"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="c-price" className={labelClass}>
              Precio (COP, sin decimales)
            </label>
            <input
              id="c-price"
              type="number"
              min={1000}
              step={1}
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
            <p className="text-[9px] tracking-[0.15em] text-white/30">
              {Number(price) >= 1000 ? `SE MOSTRARÁ COMO ${formatCOP(Number(price))}` : 'MÍNIMO 1.000 COP'}
            </p>
          </div>

          {error && (
            <p role="alert" className="text-xs tracking-[0.1em] text-accent">
              {error}
            </p>
          )}
          <p role="status" className="text-[10px] tracking-[0.3em] text-white/50">
            {notice ?? ''}
          </p>

          <button type="submit" disabled={saving} className="noid-button self-start disabled:opacity-40">
            Guardar información
          </button>
        </form>
      </section>

      {/* content */}
      <section aria-label="Contenido del curso" className="flex flex-col gap-8">
        <h2 className="noid-label">CONTENIDO</h2>
        <ContentEditor
          courseId={course.id}
          modules={modules}
          setModules={setModules}
          reload={() => void fetchContent(course.id).then(setModules)}
        />
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title="ELIMINAR CURSO"
        copy={`SE ELIMINARÁ "${course.title}" CON TODOS SUS MÓDULOS Y LECCIONES. ESTA ACCIÓN NO SE PUEDE DESHACER.`}
        confirmLabel="Eliminar"
        onConfirm={() => void onDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
