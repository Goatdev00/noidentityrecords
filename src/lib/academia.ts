import { supabase } from './supabase'

export type CourseTeacher = {
  display_name: string | null
  avatar_url: string | null
}

export type CourseSummary = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  price_cop: number
  cover_url: string | null
  teacher: CourseTeacher | null
}

export type CourseDetail = CourseSummary & {
  description: string | null
}

export type LessonMeta = {
  id: string
  title: string
  subtitle: string | null
  position: number
}

export type ModuleWithLessons = {
  id: string
  title: string
  position: number
  lessons: LessonMeta[]
}

const COURSE_COLUMNS =
  'id, slug, title, subtitle, price_cop, cover_url, teacher:profiles!courses_teacher_id_fkey(display_name, avatar_url)'

/** Published courses for the public catalog (RLS already filters drafts). */
export async function fetchPublishedCourses(): Promise<CourseSummary[]> {
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_COLUMNS)
    .eq('published', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as CourseSummary[]
}

export async function fetchCourseBySlug(slug: string): Promise<CourseDetail | null> {
  const { data, error } = await supabase
    .from('courses')
    .select(`${COURSE_COLUMNS}, description`)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as CourseDetail) ?? null
}

/** Full temario (modules + lesson titles). Public metadata by design —
 *  the actual video links live in lesson_content behind enrollment RLS. */
export async function fetchTemario(courseId: string): Promise<ModuleWithLessons[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('id, title, position, lessons(id, title, subtitle, position)')
    .eq('course_id', courseId)
    .order('position')
    .order('position', { referencedTable: 'lessons' })
  if (error) throw error
  return (data ?? []) as ModuleWithLessons[]
}

export type EnrollmentStatus = {
  enrolled: boolean
  totalLessons: number
  completedLessons: number
  /** 0–100 */
  progress: number
}

/** Whether the current user owns the course, and how far along they are. */
export async function fetchEnrollmentStatus(
  courseId: string,
  lessonIds: string[],
): Promise<EnrollmentStatus> {
  const none: EnrollmentStatus = {
    enrolled: false,
    totalLessons: lessonIds.length,
    completedLessons: 0,
    progress: 0,
  }
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .maybeSingle()
  if (!enrollment) return none

  if (lessonIds.length === 0) return { ...none, enrolled: true }

  const { count } = await supabase
    .from('lesson_progress')
    .select('lesson_id', { count: 'exact', head: true })
    .in('lesson_id', lessonIds)
  const completed = count ?? 0
  return {
    enrolled: true,
    totalLessons: lessonIds.length,
    completedLessons: completed,
    progress: Math.round((completed / lessonIds.length) * 100),
  }
}
