// send-campaign — sends a composed mailing campaign to its target audience.
//
// Super-admin only. Server-authoritative: verifies the caller is is_super,
// resolves + de-duplicates recipients from our DB, builds the branded HTML,
// and sends via Resend (Broadcasts for groups/all, a single transactional
// email for individual). Runs the actual send in the background so large
// lists don't hit the request timeout; the campaign row tracks status.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const esc = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type Campaign = {
  id: string
  subject: string
  from_name: string
  from_email: string
  reply_to: string | null
  image_url: string | null
  heading: string | null
  tagline: string | null
  body: string | null
  cta_label: string | null
  cta_url: string | null
  target: 'all' | 'group' | 'individual'
  group_id: string | null
  individual_email: string | null
}

const LOGO = 'https://noidentityrecords.com/logo-noid-wordmark.png'

/** The shared campaign template (kept in sync with the frontend preview). */
function buildHtml(c: Campaign, unsub: string): string {
  const p = 'margin:0 0 16px;font-size:14px;line-height:1.75;color:rgba(255,255,255,.72);font-family:Arial,Helvetica,sans-serif;'
  const paragraphs = (c.body ?? '')
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => `<p style="${p}">${esc(t).replace(/\n/g, '<br>')}</p>`)
    .join('')
  const image = c.image_url
    ? `<tr><td>${c.cta_url ? `<a href="${esc(c.cta_url)}">` : ''}<img src="${esc(c.image_url)}" width="600" alt="${esc(c.heading ?? 'No.ID')}" style="display:block;width:100%;height:auto;border:0;">${c.cta_url ? '</a>' : ''}</td></tr>`
    : ''
  const heading = c.heading
    ? `<h1 style="margin:0 0 8px;font-size:19px;line-height:1.35;letter-spacing:.02em;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">${esc(c.heading)}</h1>`
    : ''
  const tagline = c.tagline
    ? `<p style="margin:0 0 24px;font-size:12px;line-height:1.6;letter-spacing:.03em;text-transform:uppercase;color:#ff2d2d;font-family:Arial,Helvetica,sans-serif;">${esc(c.tagline)}</p>`
    : ''
  const cta = c.cta_label && c.cta_url
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;"><tr><td align="center" bgcolor="#ff2d2d" style="border-radius:3px;"><a href="${esc(c.cta_url)}" style="display:inline-block;padding:17px 44px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#000000;text-decoration:none;">${esc(c.cta_label)}</a></td></tr></table>`
    : ''
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#000000;border:1px solid #1a1a1a;">
${image}
<tr><td style="padding:32px 28px;">${heading}${tagline}${paragraphs}${cta}</td></tr>
<tr><td style="padding:26px 28px;border-top:1px solid #1a1a1a;text-align:center;">
<img src="${LOGO}" width="88" alt="No.ID Records" style="opacity:.7;">
<p style="margin:16px 0 0;font-size:10px;line-height:1.9;letter-spacing:.05em;color:rgba(255,255,255,.35);font-family:Arial,Helvetica,sans-serif;"><a href="${unsub}" style="color:rgba(255,255,255,.5);text-decoration:underline;">Cancelar suscripción</a> &nbsp;·&nbsp; © 2026 NO.IDENTITY</p>
</td></tr>
</table></td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''

  try {
    const { campaign_id } = await req.json().catch(() => ({}))
    if (!campaign_id) return json({ error: 'campaign_id requerido' }, 400)

    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'No autenticado' }, 401)

    const admin = createClient(url, service)
    const { data: prof } = await admin.from('profiles').select('is_super').eq('id', user.id).maybeSingle()
    if (!prof?.is_super) return json({ error: 'No autorizado' }, 403)

    const { data: campaign } = await admin.from('mailing_campaigns').select('*').eq('id', campaign_id).maybeSingle()
    if (!campaign) return json({ error: 'Campaña no encontrada' }, 404)
    if (campaign.status === 'sending' || campaign.status === 'queued') {
      return json({ error: 'La campaña ya se está enviando' }, 409)
    }

    await admin.from('mailing_campaigns').update({ status: 'queued', error: null }).eq('id', campaign_id)

    // run the send in the background so large lists don't time out
    const task = runSend(admin, resendKey, campaign as Campaign)
    // @ts-ignore EdgeRuntime is provided by the Supabase runtime
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(task)
    else await task

    return json({ status: 'queued' })
  } catch (e) {
    return json({ error: `Error: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function runSend(admin: any, resendKey: string, c: Campaign) {
  const rsend = (path: string, method: string, body?: unknown) =>
    fetch(`https://api.resend.com${path}`, {
      method,
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  try {
    await admin.from('mailing_campaigns').update({ status: 'sending' }).eq('id', c.id)

    // resolve + dedupe recipients
    let recipients: { email: string; name: string | null }[] = []
    if (c.target === 'individual') {
      if (!c.individual_email) throw new Error('Falta el correo individual')
      recipients = [{ email: c.individual_email.trim().toLowerCase(), name: null }]
    } else if (c.target === 'group') {
      if (!c.group_id) throw new Error('Falta el grupo')
      const { data } = await admin
        .from('mailing_group_members')
        .select('contact:mailing_contacts(email, name)')
        .eq('group_id', c.group_id)
      recipients = (data ?? []).map((r: any) => r.contact).filter(Boolean)
    } else {
      const { data } = await admin.from('mailing_contacts').select('email, name')
      recipients = data ?? []
    }
    // dedupe by email
    const seen = new Set<string>()
    recipients = recipients.filter((r) => {
      const e = (r.email ?? '').trim().toLowerCase()
      if (!e || seen.has(e)) return false
      seen.add(e)
      return true
    })
    if (recipients.length === 0) throw new Error('No hay destinatarios')

    const from = `${c.from_name} <${c.from_email}>`

    if (c.target === 'individual') {
      // single transactional email
      const r = await rsend('/emails', 'POST', {
        from, to: [recipients[0].email], reply_to: c.reply_to ?? undefined,
        subject: c.subject, html: buildHtml(c, '#'),
      })
      if (!r.ok) throw new Error(`Resend: ${(await r.text()).slice(0, 200)}`)
    } else {
      // Broadcast path. Resend's free plan caps total audiences at 3, so we
      // reuse a single one: delete our own leftover audiences first (lazy
      // cleanup — the previous broadcast has long since sent), then create a
      // fresh one for this campaign.
      const existing = (await (await rsend('/audiences', 'GET')).json())?.data ?? []
      for (const a of existing) {
        if (typeof a?.name === 'string' && a.name.startsWith('NOIDCAMP:')) {
          await rsend(`/audiences/${a.id}`, 'DELETE')
        }
      }
      const aRes = await rsend('/audiences', 'POST', { name: `NOIDCAMP: ${c.subject}`.slice(0, 190) })
      const aJson = await aRes.json()
      const AUD = aJson?.id
      if (!AUD) throw new Error(`No se pudo crear la audiencia: ${JSON.stringify(aJson).slice(0, 180)}`)
      const failed: typeof recipients = []
      const addOne = async (rc: typeof recipients[number]) => {
        const parts = (rc.name ?? '').split(/\s+/)
        const res = await rsend(`/audiences/${AUD}/contacts`, 'POST', {
          email: rc.email, first_name: parts[0] || '', last_name: parts.slice(1).join(' '), unsubscribed: false,
        })
        if (!res.ok) failed.push(rc)
      }
      const CHUNK = 5
      for (let i = 0; i < recipients.length; i += CHUNK) {
        await Promise.all(recipients.slice(i, i + CHUNK).map(addOne))
        await new Promise((r) => setTimeout(r, 600))
      }
      for (const rc of failed.splice(0)) { await addOne(rc); await new Promise((r) => setTimeout(r, 250)) }

      const bRes = await rsend('/broadcasts', 'POST', {
        audience_id: AUD, from, reply_to: c.reply_to ?? undefined,
        subject: c.subject, name: c.subject, html: buildHtml(c, '{{{RESEND_UNSUBSCRIBE_URL}}}'),
      })
      const BC = (await bRes.json()).id
      if (!BC) throw new Error(`No se pudo crear el broadcast: ${JSON.stringify(await bRes.json?.() ?? {})}`)
      const sRes = await rsend(`/broadcasts/${BC}/send`, 'POST', {})
      if (!sRes.ok) throw new Error(`Envío: ${(await sRes.text()).slice(0, 200)}`)
    }

    await admin.from('mailing_campaigns').update({
      status: 'sent', recipients_count: recipients.length, sent_at: new Date().toISOString(),
    }).eq('id', c.id)
  } catch (e) {
    await admin.from('mailing_campaigns').update({
      status: 'failed', error: e instanceof Error ? e.message : String(e),
    }).eq('id', c.id)
  }
}
