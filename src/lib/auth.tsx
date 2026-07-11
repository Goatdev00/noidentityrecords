import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Profile } from './supabase'

type AuthState = {
  session: Session | null
  profile: Profile | null
  /** true until the initial session restore finishes — guards wait on this */
  loading: boolean
  /** the profile fetch failed (network/API) — distinct from "no profile" */
  profileError: boolean
  /** error carried back in the URL hash by auth redirects (OAuth denied,
   *  expired confirmation link…), already translated to Spanish */
  redirectError: string | null
  clearRedirectError: () => void
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  profileError: false,
  redirectError: null,
  clearRedirectError: () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
})

/** Reads auth error params Supabase appends to the URL hash on failed
 *  redirects (e.g. #error=access_denied&error_code=otp_expired&…). */
function consumeHashError(): string | null {
  const hash = window.location.hash
  if (!hash.includes('error')) return null
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const code = params.get('error_code')
  const description = params.get('error_description')
  if (!params.get('error') && !code && !description) return null
  // clean the hash so refreshes don't re-show the error
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  if (code === 'otp_expired') {
    return 'El enlace expiró o ya fue usado. Pide uno nuevo.'
  }
  if (params.get('error') === 'access_denied') {
    return 'El acceso fue cancelado o denegado. Intenta de nuevo.'
  }
  return description
    ? `No se pudo completar el acceso: ${description.split('+').join(' ')}`
    : 'No se pudo completar el acceso. Intenta de nuevo.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [redirectError, setRedirectError] = useState<string | null>(null)

  useEffect(() => {
    // capture hash errors BEFORE any guard bounces away and drops the hash
    setRedirectError(consumeHashError())

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    // NOTE: no awaits inside this callback (supabase-js deadlock footgun);
    // profile loading reacts to the session change in the effect below
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setProfileError(false)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, display_name, avatar_url, is_super')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      setProfileError(true)
      return
    }
    setProfileError(false)
    setProfile((data as Profile) ?? null)
  }, [userId])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  // self-heal: retry the profile fetch when connectivity returns
  useEffect(() => {
    if (!profileError) return
    const retry = () => void loadProfile()
    window.addEventListener('online', retry)
    const t = setTimeout(retry, 5000)
    return () => {
      window.removeEventListener('online', retry)
      clearTimeout(t)
    }
  }, [profileError, loadProfile])

  const signOut = useCallback(async () => {
    // local scope: sign out THIS device only (default 'global' revokes every
    // session the user has anywhere)
    await supabase.auth.signOut({ scope: 'local' })
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        profileError,
        redirectError,
        clearRedirectError: () => setRedirectError(null),
        signOut,
        refreshProfile: loadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}

/** Spanish messages for the auth errors users actually hit. */
// eslint-disable-next-line react-refresh/only-export-components
export function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar. Revisa tu bandeja.'
  if (m.includes('already registered')) return 'Ya existe una cuenta con este correo.'
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 8 caracteres.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera un momento.'
  if (m.includes('invalid email') || m.includes('validate email')) return 'Ingresa un correo válido.'
  if (m.includes('same password')) return 'La nueva contraseña debe ser distinta a la anterior.'
  if (m.includes('provider is not enabled'))
    return 'El acceso con Google aún no está habilitado. Usa tu correo y contraseña.'
  return 'Algo salió mal. Intenta de nuevo.'
}
