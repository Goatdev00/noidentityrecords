import { useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import { fetchAllCourses, type AdminCourse } from '../../lib/panel'
import {
  fetchCourseStudents,
  fetchPickerUsers,
  grantAccess,
  revokeAccess,
  type EnrolledStudent,
  type PickerUser,
} from '../../lib/enrollments'
import { formatCOP } from '../../lib/format'

const inputClass =
  'w-full min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.05em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const labelClass = 'text-[10px] uppercase tracking-[0.3em] text-white/50'

export default function EnrollmentsAdmin() {
  const [courses, setCourses] = useState<AdminCourse[] | null>(null)
  const [courseId, setCourseId] = useState('')
  const [students, setStudents] = useState<EnrolledStudent[] | null>(null)
  const [users, setUsers] = useState<PickerUser[]>([])
  const [query, setQuery] = useState('')
  const [granting, setGranting] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingRevoke, setPendingRevoke] = useState<EnrolledStudent | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAllCourses()
      .then((c) => {
        setCourses(c)
        if (c.length > 0) setCourseId((prev) => prev || c[0].id)
      })
      .catch(() => setCourses([]))
    fetchPickerUsers()
      .then(setUsers)
      .catch(() => {})
  }, [])

  const loadStudents = (id: string) => {
    if (!id) return
    setStudents(null)
    fetchCourseStudents(id)
      .then(setStudents)
      .catch((e) => {
        setStudents([])
        setError(e instanceof Error ? e.message : 'No se pudo cargar la lista.')
      })
  }

  useEffect(() => {
    if (courseId) loadStudents(courseId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const course = courses?.find((c) => c.id === courseId) ?? null
  const enrolledIds = useMemo(() => new Set((students ?? []).map((s) => s.user_id)), [students])

  // people not yet enrolled, matching the search
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users
      .filter((u) => !enrolledIds.has(u.id))
      .filter(
        (u) =>
          !q ||
          u.email.toLowerCase().includes(q) ||
          (u.display_name ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [users, enrolledIds, query])

  const onGrant = async (target: { user_id?: string; email?: string }, label: string) => {
    setGranting(true)
    setError(null)
    setNotice(null)
    try {
      await grantAccess(courseId, target)
      setNotice(`Acceso otorgado a ${label}.`)
      setQuery('')
      loadStudents(courseId)
      fetchPickerUsers().then(setUsers).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dar el acceso.')
    } finally {
      setGranting(false)
    }
  }

  const onRevoke = async () => {
    const t = pendingRevoke
    setPendingRevoke(null)
    if (!t) return
    setBusy(t.user_id)
    setError(null)
    setNotice(null)
    try {
      await revokeAccess(courseId, t.user_id)
      setNotice(`Acceso retirado a ${t.display_name || t.email}.`)
      loadStudents(courseId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar el acceso.')
    } finally {
      setBusy(null)
    }
  }

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(query.trim())

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="noid-label">INSCRITOS</h2>
        <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
          Da o quita el acceso a cualquier curso, sin pago de por medio
        </p>
      </div>

      {/* course selector */}
      <div className="flex flex-col gap-2">
        <label htmlFor="curso" className={labelClass}>
          Curso
        </label>
        {courses === null ? (
          <p className="noid-label animate-pulse py-2">CARGANDO</p>
        ) : courses.length === 0 ? (
          <p className="text-xs tracking-[0.15em] text-white/40">AÚN NO HAY CURSOS.</p>
        ) : (
          <select
            id="curso"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className={inputClass}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} — {formatCOP(c.price_cop)}
                {c.published ? '' : ' (borrador)'}
              </option>
            ))}
          </select>
        )}
        {course?.teacher?.display_name && (
          <p className="text-[10px] tracking-[0.2em] text-white/30">
            Maestro: {course.teacher.display_name}
          </p>
        )}
      </div>

      {/* grant access */}
      {courseId && (
        <div className="noid-card flex flex-col gap-4 p-6">
          <label htmlFor="buscar" className={labelClass}>
            Dar acceso a alguien
          </label>
          <input
            id="buscar"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="BUSCA POR NOMBRE O CORREO…"
            className={inputClass}
          />

          {query.trim() && (
            <div className="flex flex-col divide-y divide-white/5 border border-white/5">
              {candidates.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  disabled={granting}
                  onClick={() => void onGrant({ user_id: u.id }, u.display_name || u.email)}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] disabled:opacity-40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs tracking-[0.05em] text-white/85">
                      {u.display_name || '—'}
                    </span>
                    <span className="block truncate text-[10px] tracking-[0.1em] text-white/40">
                      {u.email}
                    </span>
                  </span>
                  <span className="shrink-0 text-[9px] uppercase tracking-[0.25em] text-accent">
                    Dar acceso
                  </span>
                </button>
              ))}
              {candidates.length === 0 && (
                <div className="flex flex-col gap-3 px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                    Nadie coincide (o ya tiene el curso).
                  </p>
                  {looksLikeEmail && (
                    <button
                      type="button"
                      disabled={granting}
                      onClick={() => void onGrant({ email: query.trim() }, query.trim())}
                      className="noid-button self-start disabled:opacity-40"
                    >
                      Dar acceso a {query.trim()}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <p className="text-[9px] uppercase leading-relaxed tracking-[0.2em] text-white/30">
            La persona debe tener cuenta creada en el sitio. El acceso queda sin
            pago asociado, así no altera tus ingresos.
          </p>
        </div>
      )}

      {notice && <p className="text-xs tracking-[0.1em] text-accent">{notice}</p>}
      {error && (
        <p role="alert" className="text-xs tracking-[0.1em] text-accent">
          {error}
        </p>
      )}

      {/* enrolled list */}
      {courseId && (
        <div className="flex flex-col gap-3">
          <p className={labelClass}>
            {students === null ? 'INSCRITOS' : `${students.length} INSCRITO(S)`}
          </p>
          {students === null ? (
            <p className="noid-label animate-pulse py-6 text-center" role="status">
              CARGANDO
            </p>
          ) : students.length === 0 ? (
            <p className="py-6 text-center text-xs tracking-[0.15em] text-white/40">
              NADIE INSCRITO EN ESTE CURSO TODAVÍA.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="noid-card flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-[12px] uppercase tracking-[0.15em] text-white">
                      {s.display_name || s.email}
                    </p>
                    <p className="mt-1 truncate text-[10px] tracking-[0.15em] text-white/40">
                      {s.email} · {s.created_at.slice(0, 10)} ·{' '}
                      <span className={s.manual ? 'text-white/50' : 'text-accent'}>
                        {s.manual ? 'acceso manual' : 'pagado'}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => setPendingRevoke(s)}
                    disabled={busy === s.user_id}
                    className="shrink-0 text-[9px] uppercase tracking-[0.25em] text-white/30 transition-colors hover:text-accent disabled:opacity-40"
                  >
                    Quitar acceso
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingRevoke !== null}
        title="QUITAR ACCESO"
        copy={`${(pendingRevoke?.display_name || pendingRevoke?.email || '').toUpperCase()} PERDERÁ EL ACCESO A "${course?.title ?? ''}". SU PROGRESO SE CONSERVA POR SI SE LO DEVUELVES.`}
        confirmLabel="Quitar acceso"
        onConfirm={() => void onRevoke()}
        onCancel={() => setPendingRevoke(null)}
      />
    </div>
  )
}
