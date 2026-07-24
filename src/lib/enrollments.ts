import { supabase } from './supabase'

/** Super-admin enrollment management. Every write goes through the
 *  manage-enrollment Edge Function — the table is closed to the browser. */

export type PickerUser = {
  id: string
  email: string
  display_name: string | null
  role: string
}

export type EnrolledStudent = {
  id: string
  user_id: string
  email: string
  display_name: string | null
  /** granted by hand from Gestión (no payment behind it) */
  manual: boolean
  created_at: string
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('manage-enrollment', { body })
  if (error) {
    let message = 'No se pudo completar la operación.'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) {
        const parsed = await ctx.json()
        if (parsed?.error) message = parsed.error
      }
    } catch {
      /* keep default */
    }
    throw new Error(message)
  }
  const payload = data as T & { error?: string }
  if (payload?.error) throw new Error(payload.error)
  return payload
}

/** Every account, for the people picker. */
export async function fetchPickerUsers(): Promise<PickerUser[]> {
  const { users } = await call<{ users: PickerUser[] }>({ action: 'users' })
  return users ?? []
}

export async function fetchCourseStudents(courseId: string): Promise<EnrolledStudent[]> {
  const { students } = await call<{ students: EnrolledStudent[] }>({
    action: 'list',
    course_id: courseId,
  })
  return students ?? []
}

/** Grant access by user id (picker) or by email (typed in). */
export async function grantAccess(
  courseId: string,
  target: { user_id?: string; email?: string },
): Promise<void> {
  await call({ action: 'grant', course_id: courseId, ...target })
}

export async function revokeAccess(courseId: string, userId: string): Promise<void> {
  await call({ action: 'revoke', course_id: courseId, user_id: userId })
}
