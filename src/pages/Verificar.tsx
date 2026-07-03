import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { verifyCertificate, type VerifiedCertificate } from '../lib/certificates'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'invalid' }
  | { status: 'valid'; cert: VerifiedCertificate }

export default function Verificar() {
  const { code } = useParams<{ code: string }>()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    if (!code) {
      setState({ status: 'invalid' })
      return
    }
    let cancelled = false
    verifyCertificate(code)
      .then((cert) => {
        if (cancelled) return
        setState(cert ? { status: 'valid', cert } : { status: 'invalid' })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [code])

  const dateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-10 px-6 py-24 text-center md:py-32">
      <p className="noid-label">VERIFICACIÓN DE CERTIFICADO</p>

      {state.status === 'loading' && (
        <p className="noid-label animate-pulse" role="status">
          CARGANDO
        </p>
      )}

      {state.status === 'error' && (
        <>
          <h1 className="noid-title text-lg leading-relaxed text-white">ALGO SALIÓ MAL</h1>
          <p className="text-xs leading-loose tracking-[0.15em] text-white/40">
            NO PUDIMOS VERIFICAR EL CÓDIGO. INTENTA DE NUEVO.
          </p>
        </>
      )}

      {state.status === 'invalid' && (
        <>
          <h1 className="noid-title text-lg leading-relaxed text-white">CERTIFICADO NO VÁLIDO</h1>
          <p className="text-xs leading-loose tracking-[0.15em] text-white/40">
            NO EXISTE UN CERTIFICADO CON EL CÓDIGO <span className="text-white/70">{code}</span>.
          </p>
        </>
      )}

      {state.status === 'valid' && (
        <>
          <div className="noid-card flex w-full flex-col items-center gap-6 p-10">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-accent text-accent">
              ✓
            </span>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              Certificado auténtico
            </p>
            <h1 className="noid-title text-xl leading-relaxed text-white">
              {state.cert.student_name}
            </h1>
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Completó el curso</p>
              <p className="text-sm leading-relaxed tracking-[0.1em] text-white">
                {state.cert.course_title}
              </p>
            </div>
            <div className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.25em] text-white/40">
              <p>Impartido por {state.cert.teacher_name}</p>
              <p>{dateLabel(state.cert.issued_at)}</p>
              <p className="mt-2 text-white/25">{code}</p>
            </div>
          </div>
        </>
      )}

      <Link
        to="/academia"
        className="text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
      >
        Ver la academia →
      </Link>
    </section>
  )
}
