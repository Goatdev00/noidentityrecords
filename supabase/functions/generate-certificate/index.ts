// generate-certificate — issues (idempotently) a course certificate.
//
// Server-authoritative: verifies enrollment AND 100% progress with the
// service role before ever creating a certificate; the client cannot forge
// completion. Generates an elegant B/W PDF (pdf-lib), stores it in the
// private `certificates` bucket, inserts the row, emails it via Resend, and
// returns a short-lived signed download URL. Re-invoking for an already-issued
// certificate just returns a fresh signed URL (no re-generation, no re-email).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

/** NOID-XXXX-XXXX from crypto randomness. */
function genCode(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  return `NOID-${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}

/** Map characters the standard (WinAnsi) fonts can't encode to safe ASCII. */
const wa = (s: string) =>
  s
    .replace(/[ -‏  ]/g, ' ')
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')

/** Fake the brand's wide letter-spacing with plain ASCII spaces. */
const spaced = (s: string) => wa(s).toUpperCase().split('').join(String.fromCharCode(0x20))

const SITE = 'https://noidentityrecords.com'

async function buildPdf(opts: {
  studentName: string
  courseTitle: string
  teacherName: string
  code: string
  dateLabel: string
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([842, 595]) // A4 landscape
  const { width, height } = page.getSize()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const white = rgb(1, 1, 1)
  const dim = rgb(0.6, 0.6, 0.6)
  const faint = rgb(0.4, 0.4, 0.4)

  // black field + hairline frame
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0, 0, 0) })
  page.drawRectangle({
    x: 28, y: 28, width: width - 56, height: height - 56,
    borderColor: rgb(0.25, 0.25, 0.25), borderWidth: 1,
  })

  const center = (
    text: string, y: number, size: number, f = font, color = white,
  ) => {
    text = wa(text)
    const w = f.widthOfTextAtSize(text, size)
    page.drawText(text, { x: (width - w) / 2, y, size, font: f, color })
  }

  // logo wordmark (white on transparent → shows on black); text fallback
  try {
    const res = await fetch(`${SITE}/logo-noid-wordmark.png`)
    if (res.ok) {
      const img = await doc.embedPng(new Uint8Array(await res.arrayBuffer()))
      const w = 150
      const h = (img.height / img.width) * w
      page.drawImage(img, { x: (width - w) / 2, y: height - 110, width: w, height: h })
    } else {
      center(spaced('NO.ID'), height - 100, 22, bold)
    }
  } catch {
    center(spaced('NO.ID'), height - 100, 22, bold)
  }

  center(spaced('Certificado de finalización'), height - 165, 11, font, dim)

  center(opts.studentName, height - 250, 34, bold)

  center('ha completado el curso', height - 295, 13, font, dim)
  center(opts.courseTitle, height - 340, 20, bold)
  center(spaced(`impartido por ${opts.teacherName}`), height - 380, 11, font, dim)

  // footer: date left, code right, verify line centered
  page.drawText(spaced(opts.dateLabel), { x: 70, y: 70, size: 9, font, color: faint })
  const codeText = spaced(opts.code)
  page.drawText(codeText, {
    x: width - 70 - font.widthOfTextAtSize(codeText, 9), y: 70, size: 9, font, color: faint,
  })
  center(wa(`Verifica en noidentityrecords.com/verificar/${opts.code}`), 45, 8, font, faint)

  return await doc.save()
}

function certificateEmail(opts: {
  studentName: string
  courseTitle: string
  code: string
}): string {
  const cell = 'font-family:\'Space Grotesk\',Arial,sans-serif;'
  return `
<div style="background:#000;padding:48px 16px;${cell}">
  <div style="max-width:480px;margin:0 auto;border:1px solid rgba(255,255,255,0.12);border-radius:4px;padding:40px 32px;background:#000;text-align:center;">
    <img src="${SITE}/logo-noid-wordmark.png" alt="NO.ID RECORDS" width="140" style="display:block;margin:0 auto 32px;opacity:.9;" />
    <h1 style="color:#fff;font-size:14px;letter-spacing:.3em;text-transform:uppercase;font-weight:700;margin:0 0 24px;">Tu certificado está listo</h1>
    <p style="color:rgba(255,255,255,0.6);font-size:13px;line-height:1.9;letter-spacing:.08em;margin:0 0 12px;">
      FELICITACIONES ${opts.studentName.toUpperCase()}. COMPLETASTE EL CURSO
    </p>
    <p style="color:#fff;font-size:13px;line-height:1.7;letter-spacing:.08em;margin:0 0 28px;font-weight:700;">${opts.courseTitle}</p>
    <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:.15em;margin:0 0 8px;">TU CERTIFICADO VA ADJUNTO EN PDF.</p>
    <a href="${SITE}/verificar/${opts.code}" style="display:inline-block;border:1px solid #fff;color:#000;background:#fff;text-decoration:none;font-size:11px;letter-spacing:.3em;text-transform:uppercase;padding:14px 32px;font-weight:700;margin-top:16px;">Verificar certificado</a>
    <p style="color:rgba(255,255,255,0.3);font-size:10px;letter-spacing:.2em;margin:28px 0 0;">CÓDIGO: ${opts.code}</p>
    <p style="color:rgba(255,255,255,0.25);font-size:9px;letter-spacing:.3em;margin:24px 0 0;">© 2026 NO.IDENTITY.</p>
  </div>
</div>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''

  try {
    const { course_id } = await req.json().catch(() => ({}))
    if (!course_id) return json({ error: 'course_id requerido' }, 400)

    // authenticated caller
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'No autenticado' }, 401)

    const admin = createClient(url, service)

    // must be enrolled
    const { data: enrollment } = await admin
      .from('enrollments').select('id')
      .eq('user_id', user.id).eq('course_id', course_id).maybeSingle()
    if (!enrollment) return json({ error: 'No estás inscrito en este curso' }, 403)

    // already issued? → just re-sign
    let cert = (await admin
      .from('certificates').select('id, code, pdf_path')
      .eq('user_id', user.id).eq('course_id', course_id).maybeSingle()).data

    if (!cert) {
      const { data: course } = await admin
        .from('courses')
        .select('title, teacher:profiles!courses_teacher_id_fkey(display_name)')
        .eq('id', course_id).maybeSingle()
      if (!course) return json({ error: 'Curso no encontrado' }, 404)

      // 100% check — count lessons vs completed, server-side
      const { data: mods } = await admin.from('modules').select('id').eq('course_id', course_id)
      const moduleIds = (mods ?? []).map((m) => m.id)
      const { data: lessonRows } = moduleIds.length
        ? await admin.from('lessons').select('id').in('module_id', moduleIds)
        : { data: [] as { id: string }[] }
      const lessonIds = (lessonRows ?? []).map((l) => l.id)
      if (lessonIds.length === 0) return json({ error: 'El curso no tiene lecciones' }, 400)

      const { count } = await admin
        .from('lesson_progress').select('lesson_id', { count: 'exact', head: true })
        .eq('user_id', user.id).in('lesson_id', lessonIds)
      if ((count ?? 0) < lessonIds.length) {
        return json({ error: 'Aún no completas el 100% del curso' }, 400)
      }

      const { data: profile } = await admin
        .from('profiles').select('display_name').eq('id', user.id).maybeSingle()
      const studentName = profile?.display_name || user.email?.split('@')[0] || 'Estudiante'
      // deno-lint-ignore no-explicit-any
      const teacherName = (course as any).teacher?.display_name || 'No.ID Records'
      const dateLabel = new Date().toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
      })

      // insert row first (unique constraints guard against races/dupes),
      // retrying only on code collision
      let inserted = null
      for (let attempt = 0; attempt < 4 && !inserted; attempt++) {
        const code = genCode()
        const path = `${user.id}/${course_id}.pdf`
        const { data, error } = await admin
          .from('certificates')
          .insert({ user_id: user.id, course_id, code, pdf_path: path })
          .select('id, code, pdf_path').single()
        if (!error) { inserted = data; break }
        // 23505 on (user_id,course_id) → someone issued concurrently; fetch it
        if (error.code === '23505' && !error.message.includes('code')) {
          inserted = (await admin.from('certificates').select('id, code, pdf_path')
            .eq('user_id', user.id).eq('course_id', course_id).maybeSingle()).data
          break
        }
        // otherwise assume code collision and retry with a new code
      }
      if (!inserted) return json({ error: 'No se pudo emitir el certificado' }, 500)
      cert = inserted

      // build + store the PDF (best-effort; row already exists)
      const pdf = await buildPdf({
        studentName, courseTitle: course.title, teacherName,
        code: cert.code, dateLabel,
      })
      await admin.storage.from('certificates')
        .upload(cert.pdf_path, pdf, { contentType: 'application/pdf', upsert: true })

      // email with the PDF attached (best-effort)
      if (resendKey && user.email) {
        const b64 = btoa(String.fromCharCode(...pdf))
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'No.ID Records <no-reply@noidentityrecords.com>',
            to: [user.email],
            subject: 'TU CERTIFICADO — NO.ID RECORDS',
            html: certificateEmail({ studentName, courseTitle: course.title, code: cert.code }),
            attachments: [{ filename: `certificado-noid-${cert.code}.pdf`, content: b64 }],
          }),
        }).catch(() => {})
      }
    }

    const { data: signed } = await admin.storage
      .from('certificates').createSignedUrl(cert.pdf_path, 120)
    return json({ code: cert.code, signed_url: signed?.signedUrl ?? null })
  } catch (e) {
    return json({ error: `Error: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
