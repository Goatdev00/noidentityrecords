import type { CampaignDraft } from './mailing'

const LOGO = 'https://noidentityrecords.com/logo-noid-wordmark.png'

const esc = (s: string) =>
  (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * Builds the campaign email HTML — kept in sync with the send-campaign Edge
 * Function's template so the preview matches exactly what recipients get.
 * `unsub` is the unsubscribe URL ('#' for preview).
 */
export function buildCampaignHtml(
  c: Pick<
    CampaignDraft,
    'image_url' | 'heading' | 'tagline' | 'body' | 'cta_label' | 'cta_url'
  >,
  unsub = '#',
): string {
  const p =
    'margin:0 0 16px;font-size:14px;line-height:1.75;color:rgba(255,255,255,.72);font-family:Arial,Helvetica,sans-serif;'
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
  const cta =
    c.cta_label && c.cta_url
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;"><tr><td align="center" bgcolor="#ff2d2d" style="border-radius:3px;"><a href="${esc(c.cta_url)}" style="display:inline-block;padding:17px 44px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#000000;text-decoration:none;">${esc(c.cta_label)}</a></td></tr></table>`
      : ''
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#000000;border:1px solid #1a1a1a;">
${image}
<tr><td style="padding:32px 28px;">${heading}${tagline}${paragraphs || `<p style="${p}">Tu mensaje aparecerá aquí…</p>`}${cta}</td></tr>
<tr><td style="padding:26px 28px;border-top:1px solid #1a1a1a;text-align:center;">
<img src="${LOGO}" width="88" alt="No.ID Records" style="opacity:.7;">
<p style="margin:16px 0 0;font-size:10px;line-height:1.9;letter-spacing:.05em;color:rgba(255,255,255,.35);font-family:Arial,Helvetica,sans-serif;"><a href="${unsub}" style="color:rgba(255,255,255,.5);text-decoration:underline;">Cancelar suscripción</a> &nbsp;·&nbsp; © 2026 NO.IDENTITY</p>
</td></tr>
</table></td></tr></table></body></html>`
}
