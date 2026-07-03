import { useEffect, useState } from 'react'
import CourseCard from '../components/CourseCard'
import EmptyState from '../components/EmptyState'
import { fetchPublishedCourses, type CourseSummary } from '../lib/academia'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; courses: CourseSummary[] }

export default function Academia() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchPublishedCourses()
      .then((courses) => {
        if (!cancelled) setState({ status: 'ready', courses })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status">
        <p className="noid-label animate-pulse">CARGANDO</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <EmptyState
        label="ACADEMIA"
        title="ALGO SALIÓ MAL"
        copy="NO PUDIMOS CARGAR LOS CURSOS. REVISA TU CONEXIÓN E INTENTA DE NUEVO."
      />
    )
  }

  if (state.courses.length === 0) {
    return (
      <EmptyState
        label="ACADEMIA"
        title="EL CONOCIMIENTO ESTÁ EN CAMINO"
        copy="CURSOS DE PRODUCCIÓN DE TECHNO, DIRECTO DEL COLECTIVO. ACCESO PERMANENTE. MUY PRONTO."
      />
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 pb-28 pt-12 md:pt-20">
      <h1 className="noid-label pl-2">ACADEMIA</h1>
      <div className="flex flex-col gap-8">
        {state.courses.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
    </div>
  )
}
