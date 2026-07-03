import { supabase } from './supabase'
import type { LessonLink } from './panel'

export type LearnLesson = {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  position: number
}

export type LearnModule = {
  id: string
  title: string
  position: number
  lessons: LearnLesson[]
}

export type LessonContent = {
  video_url: string | null
  links: LessonLink[]
}

/** Direct, unambiguous enrollment check — enrollments RLS lets a user read
 *  their own rows. Avoids inferring enrollment from lesson content (which
 *  breaks when a lesson has no video row yet). */
export async function isEnrolled(courseId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

/** Content of a single lesson — only resolves if the caller is enrolled
 *  (RLS on lesson_content). Returns null when not enrolled / not found. */
export async function fetchLessonContent(lessonId: string): Promise<LessonContent | null> {
  const { data, error } = await supabase
    .from('lesson_content')
    .select('video_url, links')
    .eq('lesson_id', lessonId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { video_url: data.video_url ?? null, links: (data.links as LessonLink[]) ?? [] }
}

/** Set of completed lesson ids for the current user across the given lessons. */
export async function fetchCompleted(lessonIds: string[]): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .in('lesson_id', lessonIds)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.lesson_id as string))
}

/**
 * Mark complete = insert; RLS requires an enrollment in the lesson's course
 * and user_id defaults to auth.uid(). A plain insert (not upsert) so the
 * default is honored — PostgREST upsert would send user_id as NULL. Already
 * complete (23505) is treated as success: marking is idempotent.
 */
export async function markComplete(lessonId: string): Promise<void> {
  const { error } = await supabase.from('lesson_progress').insert({ lesson_id: lessonId })
  if (error && error.code !== '23505') throw error
}

/** Un-mark = delete the user's own row. */
export async function markIncomplete(lessonId: string): Promise<void> {
  const { error } = await supabase.from('lesson_progress').delete().eq('lesson_id', lessonId)
  if (error) throw error
}

/** Flatten modules into the linear lesson order the player navigates. */
export function flattenLessons(modules: LearnModule[]): LearnLesson[] {
  return modules.flatMap((m) =>
    [...m.lessons].sort((a, b) => a.position - b.position),
  )
}
