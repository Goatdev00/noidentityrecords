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
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, role, display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle()
    setProfile((data as Profile) ?? null)
  }, [userId])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, signOut, refreshProfile: loadProfile }}
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
  return 'Algo salió mal. Intenta de nuevo.'
}
