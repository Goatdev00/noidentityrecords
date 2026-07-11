// send-contact — delivers a visitor's message from the /contacto form to the
// label's inbox. Public (no auth): anyone can write to us. Anti-abuse via a
// honeypot field + strict validation + length caps. Reply-To is set to the
// visitor so the team can answer straight from Gmail.
const INBOX = 'noid.colombia@gmail.com'
const FROM = 'NO.ID Web <info@noidentityrecords.com>'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const esc = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''

  try {
    const body = await req.json().catch(() => ({}))
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim()
    const message = String(body.message ?? '').trim()
    const subject = String(body.subject ?? '').trim()
    const honeypot = String(body.website ?? '').trim() // bots fill hidden fields

    // silently accept bots so they don't retry, but send nothing
    if (honeypot) return json({ status: 'ok' })

    if (!name || name.length > 120) return json({ error: 'Escribe tu nombre.' }, 400)
    if (!EMAIL_RE.test(email) || email.length > 200)
      return json({ error: 'Escribe un correo válido.' }, 400)
    if (!message || message.length < 5) return json({ error: 'Escribe tu mensaje.' }, 400)
    if (message.length > 5000) return json({ error: 'El mensaje es demasiado largo.' }, 400)

    const heading = subject ? `${subject}` : 'Nuevo mensaje de contacto'
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#000;border:1px solid #1a1a1a;">
<tr><td style="padding:32px 28px;">
<p style="margin:0 0 24px;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#ff2d2d;font-family:Arial,Helvetica,sans-serif;">${esc(heading)}</p>
<p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,.5);font-family:Arial,Helvetica,sans-serif;"><strong style="color:#fff;">De:</strong> ${esc(name)} &lt;${esc(email)}&gt;</p>
<div style="margin:20px 0 0;padding:20px;border:1px solid #1a1a1a;font-size:14px;line-height:1.7;color:rgba(255,255,255,.8);font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;">${esc(message)}</div>
<p style="margin:24px 0 0;font-size:11px;color:rgba(255,255,255,.3);font-family:Arial,Helvetica,sans-serif;">Responde a este correo para contestarle directamente.</p>
</td></tr>
</table></td></tr></table></body></html>`

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [INBOX],
        reply_to: email,
        subject: `📩 ${heading} — ${name}`,
        html,
      }),
    })
    if (!r.ok) return json({ error: `No se pudo enviar: ${(await r.text()).slice(0, 160)}` }, 502)

    return json({ status: 'ok' })
  } catch (e) {
    return json({ error: `Error: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
