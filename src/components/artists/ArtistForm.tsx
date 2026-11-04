import { useRef, useState, type FormEvent } from 'react'
import {
  LIMITS,
  artistErrorMessage,
  guessLinkLabel,
  isSoundcloudUrl,
  normalizeUrl,
  uploadArtistFile,
  type ArtistInput,
} from '../../lib/artists'

const inputClass =
  'w-full min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.05em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const labelClass = 'text-[10px] uppercase tracking-[0.3em] text-white/50'
const smallBtn =
  'shrink-0 text-[10px] uppercase tracking-[0.25em] text-white/50 transition-colors hover:text-white disabled:opacity-40'
const DOC_LABELS = ['Hoja de vida', 'Portafolio', 'Press kit', 'Rider técnico']

type Props = {
  /** read once on mount — remount (key) to load a different profile */
  initial: ArtistInput
  /** storage folder owner — RLS only accepts uploads under the caller's uid */
  uploaderId: string
  submitLabel: string
  onSubmit: (input: ArtistInput) => Promise<void>
  onCancel?: () => void
}

/** Editor for an artist profile: photo, texts, links, SoundCloud tracks and
 *  CV/portfolio PDFs. Used by owners (/perfil/artista) and the label (Gestión). */
export default function ArtistForm({ initial, uploaderId, submitLabel, onSubmit, onCancel }: Props) {
  const [f, setF] = useState<ArtistInput>(initial)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'photo' | 'doc' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [newLink, setNewLink] = useState('')
  const [newTrack, setNewTrack] = useState('')
  const [docLabel, setDocLabel] = useState(DOC_LABELS[0])
  const photoRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof ArtistInput>(k: K, v: ArtistInput[K]) => {
    setNotice(null)
    setF((prev) => ({ ...prev, [k]: v }))
  }

  const onPhoto = async (file: File) => {
    setError(null)
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError('La foto debe ser JPG, PNG o WEBP.')
    if (file.size > LIMITS.photoBytes) return setError('La foto no puede pesar más de 5 MB.')
    setUploading('photo')
    try {
      const url = await uploadArtistFile(uploaderId, file, 'photo')
      set('image_url', url)
    } catch (e) {
      setError(artistErrorMessage(e))
    } finally {
      setUploading(null)
    }
  }

  const onDoc = async (file: File) => {
    setError(null)
    if (file.type !== 'application/pdf') return setError('Los documentos deben ser PDF.')
    if (file.size > LIMITS.docBytes) return setError('El PDF no puede pesar más de 10 MB.')
    if (f.documents.length >= LIMITS.documents) return setError(`Máximo ${LIMITS.documents} documentos.`)
    const label = docLabel.trim().slice(0, LIMITS.label) || 'Documento'
    setUploading('doc')
    try {
      const url = await uploadArtistFile(uploaderId, file, 'doc')
      setNotice(null)
      setF((prev) => ({ ...prev, documents: [...prev.documents, { label, url }] }))
    } catch (e) {
      setError(artistErrorMessage(e))
    } finally {
      setUploading(null)
    }
  }

  const addLink = () => {
    setError(null)
    const url = normalizeUrl(newLink)
    if (!url) return setError('Ese link no parece una dirección web válida.')
    if (f.links.length >= LIMITS.links) return setError(`Máximo ${LIMITS.links} links.`)
    set('links', [...f.links, { label: guessLinkLabel(url), url }])
    setNewLink('')
  }

  const addTrack = () => {
    setError(null)
    const url = normalizeUrl(newTrack)
    if (!url || !isSoundcloudUrl(url)) return setError('Pega un link de SoundCloud (soundcloud.com/…).')
    if (f.tracks.length >= LIMITS.tracks) return setError(`Máximo ${LIMITS.tracks} pistas.`)
    set('tracks', [...f.tracks, { url }])
    setNewTrack('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!f.name.trim()) return setError('El nombre artístico es obligatorio.')
    if (f.links.some((l) => !l.label.trim())) return setError('Cada link necesita un nombre.')
    if (f.documents.some((d) => !d.label.trim())) return setError('Cada documento necesita un nombre.')
    const clean: ArtistInput = {
      ...f,
      name: f.name.trim(),
      subtitle: f.subtitle?.trim() || null,
      city: f.city?.trim() || null,
      bio: f.bio?.trim() || null,
      links: f.links.map((l) => ({ label: l.label.trim(), url: l.url })),
      documents: f.documents.map((d) => ({ label: d.label.trim(), url: d.url })),
    }
    setSaving(true)
    try {
      await onSubmit(clean)
      setF(clean)
      setNotice('GUARDADO.')
    } catch (err) {
      setError(artistErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-10" noValidate>
      {/* photo */}
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-end">
        <div className="aspect-square w-40 shrink-0 overflow-hidden border border-white/10 bg-white/[0.02]">
          {f.image_url ? (
            <img src={f.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <img src="/logo-noid-wordmark.png" alt="" className="w-14 opacity-10" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <p className={labelClass}>Foto</p>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              disabled={uploading !== null}
              className={smallBtn}
            >
              {uploading === 'photo' ? 'Subiendo…' : f.image_url ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {f.image_url && (
              <button type="button" onClick={() => set('image_url', null)} className={smallBtn}>
                Quitar
              </button>
            )}
          </div>
          <p className="text-[10px] tracking-[0.1em] text-white/30">JPG, PNG o WEBP · máx. 5 MB · cuadrada se ve mejor</p>
        </div>
        <input
          ref={photoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onPhoto(file)
            e.target.value = ''
          }}
        />
      </div>

      {/* texts */}
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className={labelClass}>Nombre artístico *</span>
          <input
            className={inputClass}
            value={f.name}
            maxLength={LIMITS.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={labelClass}>Rol</span>
          <input
            className={inputClass}
            value={f.subtitle ?? ''}
            maxLength={LIMITS.subtitle}
            placeholder="DJ · PRODUCTOR · LIVE"
            onChange={(e) => set('subtitle', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={labelClass}>Ciudad</span>
          <input
            className={inputClass}
            value={f.city ?? ''}
            maxLength={LIMITS.city}
            placeholder="BOGOTÁ"
            onChange={(e) => set('city', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className="flex items-baseline justify-between gap-4">
            <span className={labelClass}>Biografía</span>
            <span className="text-[9px] tracking-[0.2em] text-white/30">
              {(f.bio ?? '').length}/{LIMITS.bio}
            </span>
          </span>
          <textarea
            className={`${inputClass} min-h-40 resize-y leading-relaxed`}
            value={f.bio ?? ''}
            maxLength={LIMITS.bio}
            placeholder="Tu historia, tu sonido, dónde has tocado…"
            onChange={(e) => set('bio', e.target.value)}
          />
        </label>
      </div>

      {/* links */}
      <fieldset className="flex flex-col gap-4">
        <legend className={`${labelClass} mb-4`}>Links · redes, portafolio, booking</legend>
        {f.links.length > 0 && (
          <ul className="flex flex-col gap-3">
            {f.links.map((l, i) => (
              <li key={`${l.url}-${i}`} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  aria-label="Nombre del link"
                  className={`${inputClass} sm:w-44`}
                  value={l.label}
                  maxLength={LIMITS.label}
                  onChange={(e) =>
                    set(
                      'links',
                      f.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                />
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-xs tracking-[0.05em] text-white/50 hover:text-white"
                >
                  {l.url}
                </a>
                <button
                  type="button"
                  onClick={() => set('links', f.links.filter((_, j) => j !== i))}
                  className={smallBtn}
                  aria-label={`Quitar ${l.label}`}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className={inputClass}
            value={newLink}
            placeholder="instagram.com/tu-usuario"
            aria-label="Nuevo link"
            onChange={(e) => setNewLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addLink()
              }
            }}
          />
          <button type="button" onClick={addLink} className={`${smallBtn} px-4 py-3`}>
            + Agregar
          </button>
        </div>
      </fieldset>

      {/* tracks */}
      <fieldset className="flex flex-col gap-4">
        <legend className={`${labelClass} mb-4`}>Música · links de SoundCloud</legend>
        {f.tracks.length > 0 && (
          <ul className="flex flex-col gap-3">
            {f.tracks.map((t, i) => (
              <li key={`${t.url}-${i}`} className="flex items-center gap-4">
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-xs tracking-[0.05em] text-white/60 hover:text-white"
                >
                  {t.title || t.url}
                </a>
                <button
                  type="button"
                  onClick={() => set('tracks', f.tracks.filter((_, j) => j !== i))}
                  className={smallBtn}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className={inputClass}
            value={newTrack}
            placeholder="soundcloud.com/tu-usuario/tu-set"
            aria-label="Nueva pista de SoundCloud"
            onChange={(e) => setNewTrack(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTrack()
              }
            }}
          />
          <button type="button" onClick={addTrack} className={`${smallBtn} px-4 py-3`}>
            + Agregar
          </button>
        </div>
      </fieldset>

      {/* documents */}
      <fieldset className="flex flex-col gap-4">
        <legend className={`${labelClass} mb-4`}>Documentos · hoja de vida, portafolio (PDF)</legend>
        {f.documents.length > 0 && (
          <ul className="flex flex-col gap-3">
            {f.documents.map((d, i) => (
              <li key={`${d.url}-${i}`} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  aria-label="Nombre del documento"
                  className={`${inputClass} sm:w-44`}
                  value={d.label}
                  maxLength={LIMITS.label}
                  onChange={(e) =>
                    set(
                      'documents',
                      f.documents.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                />
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-xs tracking-[0.05em] text-white/50 hover:text-white"
                >
                  Ver PDF ↗
                </a>
                <button
                  type="button"
                  onClick={() => set('documents', f.documents.filter((_, j) => j !== i))}
                  className={smallBtn}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        {f.documents.length < LIMITS.documents && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className={`${inputClass} sm:w-56`}
              value={docLabel}
              maxLength={LIMITS.label}
              list="artist-doc-labels"
              aria-label="Nombre del documento a subir"
              onChange={(e) => setDocLabel(e.target.value)}
            />
            <datalist id="artist-doc-labels">
              {DOC_LABELS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => docRef.current?.click()}
              disabled={uploading !== null}
              className={`${smallBtn} px-4 py-3`}
            >
              {uploading === 'doc' ? 'Subiendo…' : '+ Subir PDF'}
            </button>
            <input
              ref={docRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onDoc(file)
                e.target.value = ''
              }}
            />
          </div>
        )}
        <p className="text-[10px] tracking-[0.1em] text-white/30">
          Los documentos quedan públicos en tu perfil. Máx. 10 MB cada uno.
        </p>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-white/5 pt-8">
        <div className="flex flex-wrap items-center gap-6">
          <button
            type="submit"
            disabled={saving || uploading !== null}
            className="noid-button disabled:opacity-40"
          >
            {saving ? 'Guardando…' : submitLabel}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className={smallBtn}>
              Cancelar
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-xs tracking-[0.1em] text-accent">
            {error}
          </p>
        )}
        <p role="status" className="text-[10px] tracking-[0.3em] text-white/50">
          {notice ?? ''}
        </p>
      </div>
    </form>
  )
}
