import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

function Waiting() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status">
      <p className="noid-label animate-pulse">CARGANDO</p>
    </div>
  )
}

/** Shown when the profile fetch failed — never strand users on CARGANDO. */
function ProfileErrorState() {
  const { refreshProfile } = useAuth()
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-xs leading-loose tracking-[0.15em] text-white/40" role="alert">
        NO PUDIMOS CARGAR TU PERFIL. REVISA TU CONEXIÓN.
      </p>
      <button type="button" onClick={() => void refreshProfile()} className="noid-button">
        Reintentar
      </button>
    </div>
  )
}

/** /perfil etc.: requires a session; sends you to /login and back. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Waiting />
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

/** /panel: teacher or admin only. Students land back on home. */
export function RequireTeacher({ children }: { children: ReactNode }) {
  const { session, profile, loading, profileError } = useAuth()
  const location = useLocation()

  if (loading) return <Waiting />
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!profile) {
    return profileError ? <ProfileErrorState /> : <Waiting />
  }
  if (profile.role !== 'teacher' && profile.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
