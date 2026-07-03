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
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading || (session && !profile)) return <Waiting />
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
