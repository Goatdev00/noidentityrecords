import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { translateAuthError, useAuth } from '../lib/auth'

type Mode = 'signin' | 'signup' | 'forgot'

const TITLES: Record<Mode, string> = {
  signin: 'IDENTIFÍCATE EN EL VACÍO',
  signup: 'CREA TU CUENTA',
  forgot: 'RECUPERA TU ACCESO',
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
    </svg>
  )
}

const inputClass =
  'w-full border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.1em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'

export default function Login() {
  const { session, loading, redirectError, clearRedirectError } = useAuth()
  const location = useLocation()
  const [params] = useSearchParams()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // the confirmation link redirect carries failures in the URL hash
  // (consumed by AuthProvider) — never show the success notice over one
  const [notice, setNotice] = useState<string | null>(
    params.get('verified') && !redirectError
      ? 'CORREO CONFIRMADO. YA PUEDES ENTRAR.'
      : null,
  )

  // returning here via browser Back from the Google consent screen restores
  // the page from bfcache with busy still true — unstick the form
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  const from = (location.state as { from?: string } | null)?.from ?? '/perfil'

  if (!loading && session) return <Navigate to={from} replace />

  const withGoogle = async () => {
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${from}` },
    })
    if (err) {
      setError(translateAuthError(err.message))
      setBusy(false)
    }
    // on success the browser navigates away
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    clearRedirectError()
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) setError(translateAuthError(err.message))
        // success: session change redirects via <Navigate> above
      } else if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() || null },
            emailRedirectTo: `${window.location.origin}/login?verified=1`,
          },
        })
        if (err) setError(translateAuthError(err.message))
        else if (data.user?.identities?.length === 0)
          setError('Ya existe una cuenta con este correo.')
        else setNotice('REVISA TU CORREO PARA CONFIRMAR TU CUENTA.')
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/restablecer`,
        })
        if (err) setError(translateAuthError(err.message))
        else setNotice('SI EL CORREO EXISTE, RECIBIRÁS UN ENLACE PARA RESTABLECER TU CONTRASEÑA.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto flex max-w-sm flex-col items-center gap-10 px-6 py-24 text-center md:py-32">
      <p className="noid-label">ACCESO</p>
      <h1 className="noid-title text-base leading-relaxed text-white md:text-lg">
        {TITLES[mode]}
      </h1>

      {mode !== 'forgot' && (
        <>
          <button
            type="button"
            onClick={withGoogle}
            disabled={busy}
            className="noid-button flex w-full items-center justify-center gap-3 disabled:opacity-40"
          >
            <GoogleIcon />
            Continuar con Google
          </button>
          <div aria-hidden="true" className="flex w-full items-center gap-4">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] tracking-[0.3em] text-white/30">O</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="flex w-full flex-col gap-4">
        {mode === 'signup' && (
          <input
            type="text"
            autoComplete="name"
            placeholder="NOMBRE"
            aria-label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        )}
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="CORREO"
          aria-label="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        {mode !== 'forgot' && (
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="CONTRASEÑA"
            aria-label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        )}

        {(error || redirectError) && (
          <p role="alert" className="text-xs leading-relaxed tracking-[0.1em] text-accent">
            {error ?? redirectError}
          </p>
        )}
        {/* always mounted so screen readers announce the swap */}
        <p role="status" className="text-xs leading-loose tracking-[0.15em] text-white/60">
          {notice ?? ''}
        </p>

        <button type="submit" disabled={busy} className="noid-button w-full disabled:opacity-40">
          {mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : 'Enviar enlace'}
        </button>
      </form>

      <div className="flex flex-col gap-3 text-[10px] uppercase tracking-[0.25em]">
        {mode !== 'signin' && (
          <button type="button" onClick={() => { setMode('signin'); setError(null) }} className="text-white/40 transition-colors hover:text-white">
            Ya tengo cuenta — entrar
          </button>
        )}
        {mode !== 'signup' && (
          <button type="button" onClick={() => { setMode('signup'); setError(null) }} className="text-white/40 transition-colors hover:text-white">
            No tengo cuenta — crearla
          </button>
        )}
        {mode !== 'forgot' && (
          <button type="button" onClick={() => { setMode('forgot'); setError(null) }} className="text-white/40 transition-colors hover:text-white">
            Olvidé mi contraseña
          </button>
        )}
      </div>
    </section>
  )
}
