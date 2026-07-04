import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
  fetchMyCertificates,
  issueCertificate,
  type MyCertificate,
} from '../lib/certificates'
import { fetchMyEnrollments, type EnrolledCourse } from '../lib/academia'

const ROLE_LABEL: Record<string, string> = {
  student: 'ESTUDIANTE',
  teacher: 'MAESTRO',
  admin: 'ADMIN',
}

export default function Perfil() {
  const { session, profile, refreshProfile } = useAuth()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [certificates, setCertificates] = useState<MyCertificate[]>([])
  const [courses, setCourses] = useState<EnrolledCourse[] | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    fetchMyCertificates()
      .then((c) => {
        if (!cancelled) setCertificates(c)
      })
      .catch(() => {
        /* certificates section just stays empty */
      })
    fetchMyEnrollments()
      .then((c) => {
        if (!cancelled) setCourses(c)
      })
      .catch(() => {
        if (!cancelled) setCourses([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const downloadCertificate = async (cert: MyCertificate) => {
    setDownloadingId(cert.id)
    setError(null)
    // open the tab synchronously inside the click gesture; after the await the
    // browser would treat window.open as a pop-up and block it
    const win = window.open('about:blank', '_blank')
    try {
      const { signed_url } = await issueCertificate(cert.course_id)
      if (signed_url) {
        if (win) win.location.href = signed_url
        else window.location.assign(signed_url)
      } else {
        win?.close()
        setError('No se pudo obtener el certificado.')
      }
    } catch (e) {
      win?.close()
      setError(e instanceof Error ? e.message : 'No se pudo obtener el certificado.')
    } finally {
      setDownloadingId(null)
    }
  }

  // seed the input when the profile (finally) loads or gets refreshed —
  // a lazy render-time fallback would freeze after the first keystroke and
  // could wipe the saved name if the user submits before the profile loads
  useEffect(() => {
    setName(profile?.display_name ?? '')
  }, [profile?.display_name])

  if (!session) return null // RequireAuth already gates; belt and braces
  const displayName = name

  const saveName = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    // profiles has INSERT revoked by design — always update, never upsert
    const { error: err } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null })
      .eq('id', session.user.id)
    setSaving(false)
    if (err) setError('No se pudo guardar. Intenta de nuevo.')
    else {
      setNotice('GUARDADO.')
      void refreshProfile()
    }
  }

  const uploadAvatar = async (file: File) => {
    setUploading(true)
    setError(null)
    setNotice(null)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    // fixed path under the user's uid (storage RLS rejects anything else):
    // upsert overwrites instead of piling up orphaned public files
    const path = `${session.user.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) {
      setUploading(false)
      setError('No se pudo subir la imagen.')
      return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    // cache-bust: same path, new bytes — browsers would keep the old image
    const freshUrl = `${data.publicUrl}?v=${Date.now()}`
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ avatar_url: freshUrl })
      .eq('id', session.user.id)
    setUploading(false)
    if (updErr) setError('No se pudo actualizar el avatar.')
    else void refreshProfile()
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-16 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col items-center gap-6 text-center">
        <h1 className="noid-label">PERFIL</h1>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="group relative h-24 w-24 overflow-hidden rounded-full border border-white/10 transition-colors duration-300 hover:border-white/40"
          aria-label="Cambiar avatar"
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-display text-xl text-white/40">
              {(displayName || session.user.email || '?').charAt(0).toUpperCase()}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-[8px] uppercase tracking-[0.3em] text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            {uploading ? '…' : 'Cambiar'}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void uploadAvatar(f)
            e.target.value = ''
          }}
        />

        <div className="flex flex-col gap-2">
          <p className="max-w-full break-all text-xs tracking-[0.15em] text-white/60">
            {session.user.email}
          </p>
          <p className="text-[9px] uppercase tracking-[0.4em] text-white/30">
            {ROLE_LABEL[profile?.role ?? 'student']}
          </p>
        </div>
      </header>

      <form onSubmit={saveName} className="flex flex-col gap-4">
        <label
          htmlFor="display_name"
          className="text-[10px] uppercase tracking-[0.3em] text-white/40"
        >
          Nombre visible
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="display_name"
            type="text"
            value={displayName}
            onChange={(e) => setName(e.target.value)}
            placeholder="TU NOMBRE"
            className="min-w-0 flex-1 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.1em] text-white placeholder:text-white/25 transition-colors duration-300 focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !profile}
            className="noid-button disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs tracking-[0.1em] text-accent">{error}</p>
        )}
        {/* always mounted so screen readers announce the swap */}
        <p role="status" className="text-[10px] tracking-[0.3em] text-white/50">
          {notice ?? ''}
        </p>
      </form>

      <section id="cursos" aria-label="Mis cursos" className="flex scroll-mt-28 flex-col gap-6">
        <h2 className="noid-label">MIS CURSOS</h2>
        {courses === null ? (
          <div className="noid-card flex min-h-[120px] items-center justify-center" role="status">
            <p className="noid-label animate-pulse">CARGANDO</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="noid-card flex flex-col items-center gap-4 p-10 text-center">
            <p className="text-xs leading-loose tracking-[0.15em] text-white/60">
              AÚN NO ESTÁS INSCRITO EN NINGÚN CURSO.
            </p>
            <Link
              to="/academia"
              className="text-[10px] uppercase tracking-[0.3em] text-white/60 transition-colors hover:text-white"
            >
              Explorar la academia →
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {courses.map((c) => (
              <li key={c.courseId}>
                <Link
                  to={`/academia/${c.slug}/aprender`}
                  className="noid-card flex items-center gap-4 px-6 py-5"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden border border-white/10 bg-white/[0.02]">
                    {c.coverUrl ? (
                      <img src={c.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <img src="/logo-noid-wordmark.png" alt="" className="w-8 opacity-20" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="truncate text-[11px] uppercase tracking-[0.15em] text-white">
                      {c.title}
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-px flex-1 bg-white/10"
                        role="progressbar"
                        aria-valuenow={c.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progreso de ${c.title}`}
                      >
                        <div
                          className="h-px bg-accent transition-all duration-700"
                          style={{ width: `${c.progress}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[9px] uppercase tracking-[0.25em] text-white/50">
                        {c.progress}%
                      </span>
                    </div>
                  </div>
                  <span aria-hidden="true" className="shrink-0 text-white/30">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {certificates.length > 0 && (
        <section
          id="certificados"
          aria-label="Mis certificados"
          className="flex scroll-mt-28 flex-col gap-6"
        >
          <h2 className="noid-label">MIS CERTIFICADOS</h2>
          <ul className="flex flex-col gap-4">
            {certificates.map((cert) => (
              <li
                key={cert.id}
                className="noid-card flex flex-wrap items-center justify-between gap-4 px-6 py-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs tracking-[0.1em] text-white">
                    {cert.course?.title ?? 'Curso'}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.25em] text-white/30">
                    {new Date(cert.issued_at).toLocaleDateString('es-CO', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    · {cert.code}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void downloadCertificate(cert)}
                  disabled={downloadingId === cert.id}
                  className="shrink-0 text-[10px] uppercase tracking-[0.3em] text-accent transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  {downloadingId === cert.id ? 'Generando…' : 'Descargar ↓'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="pedidos" aria-label="Mis pedidos" className="flex scroll-mt-28 flex-col gap-6">
        <h2 className="noid-label">MIS PEDIDOS</h2>
        <div className="noid-card flex flex-col items-center gap-4 p-10 text-center">
          <p className="text-xs leading-loose tracking-[0.15em] text-white/60">
            SIN PEDIDOS TODAVÍA.
          </p>
          <Link
            to="/merch"
            className="text-[10px] uppercase tracking-[0.3em] text-white/60 transition-colors hover:text-white"
          >
            Ver la merch →
          </Link>
        </div>
      </section>
    </div>
  )
}
