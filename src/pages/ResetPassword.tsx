import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { translateAuthError, useAuth } from '../lib/auth'

const inputClass =
  'w-full border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.1em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'

/**
 * Landing for the recovery email link. The link itself creates a session
 * (supabase-js picks it up from the URL), so: session present → new password
 * form; no session after load → the link is invalid or expired.
 */
export default function ResetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [settled, setSettled] = useState(false)
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // give supabase-js a beat to consume the token from the URL
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setSettled(true), 800)
      return () => clearTimeout(t)
    }
  }, [loading])

  // don't let the post-success redirect fire if the user navigated away
  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) {
      setError(translateAuthError(err.message))
    } else {
      setDone(true)
      redirectTimer.current = setTimeout(
        () => navigate('/perfil', { replace: true }),
        1500,
      )
    }
  }

  if (!session && !settled) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status">
        <p className="noid-label animate-pulse">CARGANDO</p>
      </div>
    )
  }

  if (!session) {
    return (
      <section className="mx-auto flex max-w-sm flex-col items-center gap-8 px-6 py-32 text-center">
        <p className="noid-label">ACCESO</p>
        <h1 className="noid-title text-base leading-relaxed text-white">
          ENLACE INVÁLIDO O EXPIRADO
        </h1>
        <p className="text-xs leading-loose tracking-[0.15em] text-white/40">
          SOLICITA UN NUEVO ENLACE DESDE LA PANTALLA DE ACCESO.
        </p>
        <Link to="/login" className="noid-button">
          Volver al acceso
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto flex max-w-sm flex-col items-center gap-10 px-6 py-24 text-center md:py-32">
      <p className="noid-label">ACCESO</p>
      <h1 className="noid-title text-base leading-relaxed text-white">
        NUEVA CONTRASEÑA
      </h1>

      {done ? (
        <p role="alert" className="text-xs leading-loose tracking-[0.15em] text-white/60">
          CONTRASEÑA ACTUALIZADA. ENTRANDO…
        </p>
      ) : (
        <form onSubmit={submit} className="flex w-full flex-col gap-4">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="NUEVA CONTRASEÑA"
            aria-label="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="CONFIRMAR CONTRASEÑA"
            aria-label="Confirmar contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
          {error && (
            <p role="alert" className="text-xs leading-relaxed tracking-[0.1em] text-accent">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="noid-button w-full disabled:opacity-40">
            Guardar contraseña
          </button>
        </form>
      )}
    </section>
  )
}
