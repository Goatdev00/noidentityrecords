import { supabase } from './supabase'

/** Teacher-panel data layer. Every call here runs under the caller's JWT —
 *  RLS guarantees a teacher only ever touches their own courses. */

export type PanelCourse = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  price_cop: number
  cover_url: string | null
  published: boolean
  created_at: string
}

export type LessonLink = { label: string; url: string }

export type PanelLesson = {
  id: string
  module_id: string
  title: string
  subtitle: string | null
  description: string | null
  position: number
}

export type PanelModule = {
  id: string
  title: string
  position: number
  lessons: PanelLesson[]
}

export type LessonContent = {
  video_url: string | null
  links: LessonLink[]
}

/** "Técnicas de producción" → "tecnicas-de-produccion" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// ── courses ────────────────────────────────────────────────────────────────

export async function fetchMyCourses(teacherId: string): Promise<PanelCourse[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, slug, title, subtitle, description, price_cop, cover_url, published, created_at')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PanelCourse[]
}

export async function fetchMyCourse(id: string): Promise<PanelCourse | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, slug, title, subtitle, description, price_cop, cover_url, published, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as PanelCourse) ?? null
}

export async function createCourse(teacherId: string, title: string): Promise<PanelCourse> {
  const base = slugify(title) || 'curso'
  // salt the slug if taken — cheap retry loop, unique index has the final say
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.floor(Math.random() * 1000)}`
    const { data, error } = await supabase
      .from('courses')
      .insert({ teacher_id: teacherId, title, slug, price_cop: 1000 })
      .select()
      .single()
    if (!error) return data as PanelCourse
    if (!error.message.includes('duplicate')) throw error
  }
  throw new Error('slug collision')
}

export async function updateCourse(
  id: string,
  patch: Partial<Pick<PanelCourse, 'title' | 'subtitle' | 'description' | 'price_cop' | 'cover_url' | 'published' | 'slug'>>,
): Promise<void> {
  const { error, data } = await supabase.from('courses').update(patch).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('not updated')
}

export async function deleteCourse(id: string): Promise<void> {
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
}

/** Cover goes under course-covers/{teacher uid}/… (storage RLS requirement). */
export async function uploadCover(teacherId: string, courseId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${teacherId}/${courseId}-cover.${ext}`
  const { error } = await supabase.storage
    .from('course-covers')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('course-covers').getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

// ── modules & lessons ──────────────────────────────────────────────────────

export async function fetchContent(courseId: string): Promise<PanelModule[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('id, title, position, lessons(id, module_id, title, subtitle, description, position)')
    .eq('course_id', courseId)
    .order('position')
    .order('position', { referencedTable: 'lessons' })
  if (error) throw error
  return (data ?? []) as PanelModule[]
}

export async function createModule(courseId: string, title: string, position: number): Promise<PanelModule> {
  const { data, error } = await supabase
    .from('modules')
    .insert({ course_id: courseId, title, position })
    .select('id, title, position')
    .single()
  if (error) throw error
  return { ...(data as Omit<PanelModule, 'lessons'>), lessons: [] }
}

export async function renameModule(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('modules').update({ title }).eq('id', id)
  if (error) throw error
}

export async function deleteModule(id: string): Promise<void> {
  const { error } = await supabase.from('modules').delete().eq('id', id)
  if (error) throw error
}

export async function createLesson(
  moduleId: string,
  title: string,
  position: number,
): Promise<PanelLesson> {
  const { data, error } = await supabase
    .from('lessons')
    .insert({ module_id: moduleId, title, position })
    .select('id, module_id, title, subtitle, description, position')
    .single()
  if (error) throw error
  return data as PanelLesson
}

export async function updateLesson(
  id: string,
  patch: Partial<Pick<PanelLesson, 'title' | 'subtitle' | 'description'>>,
): Promise<void> {
  const { error } = await supabase.from('lessons').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase.from('lessons').delete().eq('id', id)
  if (error) throw error
}

/** Duplicate a lesson (metadata + content) into the same module, at the end. */
export async function duplicateLesson(lesson: PanelLesson, position: number): Promise<PanelLesson> {
  const copy = await createLesson(lesson.module_id, `${lesson.title} (copia)`, position)
  await updateLesson(copy.id, { subtitle: lesson.subtitle, description: lesson.description })
  const content = await fetchLessonContent(lesson.id)
  if (content.video_url || content.links.length > 0) {
    await saveLessonContent(copy.id, content)
  }
  return { ...copy, subtitle: lesson.subtitle, description: lesson.description }
}

/** Duplicate a module with all its lessons (and their content), at the end. */
export async function duplicateModule(
  courseId: string,
  module: PanelModule,
  position: number,
): Promise<PanelModule> {
  const copy = await createModule(courseId, `${module.title} (copia)`, position)
  const lessons: PanelLesson[] = []
  for (const [i, lesson] of module.lessons.entries()) {
    const l = await createLesson(copy.id, lesson.title, i + 1)
    await updateLesson(l.id, { subtitle: lesson.subtitle, description: lesson.description })
    const content = await fetchLessonContent(lesson.id)
    if (content.video_url || content.links.length > 0) {
      await saveLessonContent(l.id, content)
    }
    lessons.push({ ...l, subtitle: lesson.subtitle, description: lesson.description })
  }
  return { ...copy, lessons }
}

/** Persist new positions after a drag (and module move if it changed). */
export async function persistPositions(modules: PanelModule[]): Promise<void> {
  const moduleUpdates = modules.map((m, i) =>
    supabase.from('modules').update({ position: i + 1 }).eq('id', m.id),
  )
  const lessonUpdates = modules.flatMap((m) =>
    m.lessons.map((l, i) =>
      supabase.from('lessons').update({ position: i + 1, module_id: m.id }).eq('id', l.id),
    ),
  )
  const results = await Promise.all([...moduleUpdates, ...lessonUpdates])
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}

// ── lesson content (video + links) ─────────────────────────────────────────

export async function fetchLessonContent(lessonId: string): Promise<LessonContent> {
  const { data, error } = await supabase
    .from('lesson_content')
    .select('video_url, links')
    .eq('lesson_id', lessonId)
    .maybeSingle()
  if (error) throw error
  return {
    video_url: data?.video_url ?? null,
    links: (data?.links as LessonLink[]) ?? [],
  }
}

export async function saveLessonContent(lessonId: string, content: LessonContent): Promise<void> {
  // lesson_content is teacher-writable by RLS; upsert covers first save + edits
  const { error } = await supabase
    .from('lesson_content')
    .upsert({ lesson_id: lessonId, video_url: content.video_url, links: content.links })
  if (error) throw error
}
