import { supabase } from './supabase'

export type MyCertificate = {
  id: string
  code: string
  issued_at: string
  course_id: string
  course: { title: string; slug: string } | null
}

export type VerifiedCertificate = {
  student_name: string
  course_title: string
  teacher_name: string
  issued_at: string
}

/**
 * Issue (idempotently) the certificate for a course and get a short-lived
 * signed download URL. The Edge Function verifies 100% completion server-side;
 * calling it for an already-issued certificate just re-signs the PDF.
 */
export async function issueCertificate(
  courseId: string,
): Promise<{ code: string; signed_url: string | null }> {
  const { data, error } = await supabase.functions.invoke('generate-certificate', {
    body: { course_id: courseId },
  })
  if (error) {
    // surface the function's Spanish error message when present
    let message = 'No se pudo generar el certificado.'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) {
        const body = await ctx.json()
        if (body?.error) message = body.error
      }
    } catch {
      /* keep default */
    }
    throw new Error(message)
  }
  return data as { code: string; signed_url: string | null }
}

/** The current user's certificates with course info. */
export async function fetchMyCertificates(): Promise<MyCertificate[]> {
  const { data, error } = await supabase
    .from('certificates')
    .select('id, code, issued_at, course_id, course:courses(title, slug)')
    .order('issued_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as MyCertificate[]
}

/** Public verification (anon RPC) — returns null if the code doesn't exist. */
export async function verifyCertificate(code: string): Promise<VerifiedCertificate | null> {
  const { data, error } = await supabase.rpc('verify_certificate', { p_code: code })
  if (error) throw error
  const rows = (data ?? []) as VerifiedCertificate[]
  return rows[0] ?? null
}
