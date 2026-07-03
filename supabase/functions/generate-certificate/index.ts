// generate-certificate — issues (idempotently) a course certificate.
//
// Server-authoritative: verifies enrollment AND 100% progress with the
// service role before creating anything; the client cannot forge completion.
// The PDF is built AND uploaded to the private `certificates` bucket BEFORE
// the row is inserted — so a font/upload failure never leaves an orphan row
// that can't be regenerated. Re-invoking self-heals a missing PDF and, for an
// already-issued certificate, just returns a fresh signed URL (no re-email).
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

/** Make any string safe for the standard (WinAnsi/CP1252) fonts so drawText
 *  can NEVER throw: remap common punctuation, then drop anything outside
 *  printable ASCII + Latin-1 (keeps accents/ñ/ü/¿¡, strips emoji/CJK/controls). */
const wa = (s: string) =>
  (s ?? '')
    .normalize('NFC')
    .replace(/[ -‏  ]/g, ' ')
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E -ÿ]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim()

/** Fake the brand's wide letter-spacing with plain ASCII spaces. */
const spaced = (s: string) => wa(s).toUpperCase().split('').join(String.fromCharCode(0x20))

const SITE = 'https://noidentityrecords.com'

type Names = {
  studentName: string
  courseTitle: string
  teacherName: string
  dateLabel: string
}

async function buildPdf(names: Names, code: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([842, 595]) // A4 landscape
  const { width, height } = page.getSize()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const white = rgb(1, 1, 1)
  const dim = rgb(0.6, 0.6, 0.6)
  const faint = rgb(0.4, 0.4, 0.4)

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0, 0, 0) })
  page.drawRectangle({
    x: 28, y: 28, width: width - 56, height: height - 56,
    borderColor: rgb(0.25, 0.25, 0.25), borderWidth: 1,
  })

  // centered text that shrinks to fit inside the frame margins
  const center = (raw: string, y: number, size: number, f = font, color = white) => {
    const text = wa(raw)
    const maxW = width - 140
    let s = size
    while (s > 6 && f.widthOfTextAtSize(text, s) > maxW) s -= 1
    const w = f.widthOfTextAtSize(text, s)
    page.drawText(text, { x: (width - w) / 2, y, size: s, font: f, color })
  }

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
  center(names.studentName, height - 250, 34, bold)
  center('ha completado el curso', height - 295, 13, font, dim)
  center(names.courseTitle, height - 340, 20, bold)
  center(spaced(`impartido por ${names.teacherName}`), height - 380, 11, font, dim)

  page.drawText(wa(spaced(names.dateLabel)), { x: 70, y: 70, size: 9, font, color: faint })
  const codeText = spaced(code)
  page.drawText(codeText, {
    x: width - 70 - font.widthOfTextAtSize(codeText, 9), y: 70, size: 9, font, color: faint,
  })
  center(`Verifica en noidentityrecords.com/verificar/${code}`, 45, 8, font, faint)

  return await doc.save()
}

function certificateEmail(studentName: string, courseTitle: string, code: string): string {
  return `
<div style="background:#000;padding:48px 16px;font-family:'Space Grotesk',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;border:1px solid rgba(255,255,255,0.12);border-radius:4px;padding:40px 32px;background:#000;text-align:center;">
    <img src="${SITE}/logo-noid-wordmark.png" alt="NO.ID RECORDS" width="140" style="display:block;margin:0 auto 32px;opacity:.9;" />
    <h1 style="color:#fff;font-size:14px;letter-spacing:.3em;text-transform:uppercase;font-weight:700;margin:0 0 24px;">Tu certificado está listo</h1>
    <p style="color:rgba(255,255,255,0.6);font-size:13px;line-height:1.9;letter-spacing:.08em;margin:0 0 12px;">
      FELICITACIONES ${studentName.toUpperCase()}. COMPLETASTE EL CURSO
    </p>
    <p style="color:#fff;font-size:13px;line-height:1.7;letter-spacing:.08em;margin:0 0 28px;font-weight:700;">${courseTitle}</p>
    <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:.15em;margin:0 0 8px;">TU CERTIFICADO VA ADJUNTO EN PDF.</p>
    <a href="${SITE}/verificar/${code}" style="display:inline-block;border:1px solid #fff;color:#000;background:#fff;text-decoration:none;font-size:11px;letter-spacing:.3em;text-transform:uppercase;padding:14px 32px;font-weight:700;margin-top:16px;">Verificar certificado</a>
    <p style="color:rgba(255,255,255,0.3);font-size:10px;letter-spacing:.2em;margin:28px 0 0;">CÓDIGO: ${code}</p>
    <p style="color:rgba(255,255,255,0.25);font-size:9px;letter-spacing:.3em;margin:24px 0 0;">© 2026 NO.IDENTITY.</p>
  </div>
</div>`
}

/** base64 without spread-args (safe for any PDF size). */
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
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

    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'No autenticado' }, 401)

    const admin = createClient(url, service)
    const path = `${user.id}/${course_id}.pdf`

    // must be enrolled
    const { data: enrollment } = await admin
      .from('enrollments').select('id')
      .eq('user_id', user.id).eq('course_id', course_id).maybeSingle()
    if (!enrollment) return json({ error: 'No estás inscrito en este curso' }, 403)

    // load names lazily (needed for a fresh issue or a self-heal rebuild)
    const loadNames = async (): Promise<Names> => {
      const { data: course } = await admin
        .from('courses')
        .select('title, teacher:profiles!courses_teacher_id_fkey(display_name)')
        .eq('id', course_id).maybeSingle()
      const { data: profile } = await admin
        .from('profiles').select('display_name').eq('id', user.id).maybeSingle()
      // deno-lint-ignore no-explicit-any
      const teacherName = (course as any)?.teacher?.display_name || 'No.ID Records'
      return {
        studentName: profile?.display_name || user.email?.split('@')[0] || 'Estudiante',
        courseTitle: course?.title || 'Curso',
        teacherName,
        dateLabel: new Date().toLocaleDateString('es-CO', {
          day: '2-digit', month: 'long', year: 'numeric',
        }),
      }
    }

    const buildAndUpload = async (names: Names, code: string) => {
      const pdf = await buildPdf(names, code)
      const { error } = await admin.storage
        .from('certificates').upload(path, pdf, { contentType: 'application/pdf', upsert: true })
      if (error) throw new Error(`upload: ${error.message}`)
      return pdf
    }

    // already issued? re-sign (self-healing the PDF if the object is missing)
    const existing = (await admin
      .from('certificates').select('id, code, pdf_path')
      .eq('user_id', user.id).eq('course_id', course_id).maybeSingle()).data

    if (existing) {
      let signed = (await admin.storage.from('certificates').createSignedUrl(existing.pdf_path, 120)).data
      if (!signed?.signedUrl) {
        try {
          await buildAndUpload(await loadNames(), existing.code)
          signed = (await admin.storage.from('certificates').createSignedUrl(existing.pdf_path, 120)).data
        } catch (e) {
          return json({ error: `No se pudo preparar el certificado: ${e instanceof Error ? e.message : e}` }, 500)
        }
      }
      return json({ code: existing.code, signed_url: signed?.signedUrl ?? null })
    }

    // ── fresh issue ── verify 100% first
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

    const names = await loadNames()

    // build + upload the PDF BEFORE claiming the row; retry only on code
    // collision. If build/upload fails, nothing is inserted → user can retry.
    let cert: { id: string; code: string; pdf_path: string } | null = null
    let freshlyIssued = false
    let lastPdf: Uint8Array | null = null
    for (let attempt = 0; attempt < 4 && !cert; attempt++) {
      const code = genCode()
      try {
        lastPdf = await buildAndUpload(names, code)
      } catch (e) {
        return json({ error: `No se pudo generar el certificado: ${e instanceof Error ? e.message : e}` }, 500)
      }
      const { data, error } = await admin
        .from('certificates')
        .insert({
          user_id: user.id, course_id, code, pdf_path: path,
          student_name: names.studentName, teacher_name: names.teacherName, course_title: names.courseTitle,
        })
        .select('id, code, pdf_path').single()
      if (!error) { cert = data; freshlyIssued = true; break }
      if (error.code === '23505') {
        if (!error.message.includes('code')) {
          // concurrent winner claimed (user_id, course_id) — use theirs
          cert = (await admin.from('certificates').select('id, code, pdf_path')
            .eq('user_id', user.id).eq('course_id', course_id).maybeSingle()).data
          break
        }
        // else code collision → loop with a new code
      } else {
        return json({ error: 'No se pudo emitir el certificado' }, 500)
      }
    }
    if (!cert) return json({ error: 'No se pudo emitir el certificado' }, 500)

    // email only for a genuinely new certificate (best-effort)
    if (freshlyIssued && resendKey && user.email && lastPdf) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'No.ID Records <no-reply@noidentityrecords.com>',
          to: [user.email],
          subject: 'TU CERTIFICADO — NO.ID RECORDS',
          html: certificateEmail(names.studentName, names.courseTitle, cert.code),
          attachments: [{ filename: `certificado-noid-${cert.code}.pdf`, content: toBase64(lastPdf) }],
        }),
      }).catch(() => {})
    }

    const { data: signed } = await admin.storage
      .from('certificates').createSignedUrl(cert.pdf_path, 120)
    return json({ code: cert.code, signed_url: signed?.signedUrl ?? null })
  } catch (e) {
    return json({ error: `Error: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
