import { useEffect, useMemo, useRef, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import { buildCampaignHtml } from '../../lib/campaignHtml'
import { useAuth } from '../../lib/auth'
import {
  fetchCampaign,
  fetchContacts,
  fetchGroups,
  saveCampaign,
  sendCampaign,
  sendCampaignTest,
  uploadCampaignImage,
  type CampaignDraft,
  type Group,
} from '../../lib/mailing'

const inputClass =
  'w-full min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.05em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const labelClass = 'text-[10px] uppercase tracking-[0.3em] text-white/50'

const EMPTY: CampaignDraft = {
  subject: '',
  from_name: 'No.ID Records',
  from_email: 'info@noidentityrecords.com',
  reply_to: 'noid.colombia@gmail.com',
  image_url: null,
  heading: '',
  tagline: '',
  body: '',
  cta_label: '',
  cta_url: '',
  target: 'all',
  group_id: null,
  individual_email: null,
}

export default function MailingCompose({ onSent }: { onSent: () => void }) {
  const { session } = useAuth()
  const [d, setD] = useState<CampaignDraft>(EMPTY)
  const [groups, setGroups] = useState<Group[]>([])
  const [totalContacts, setTotalContacts] = useState(0)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [testing, setTesting] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [previewWidth, setPreviewWidth] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchGroups().then(setGroups).catch(() => {})
    fetchContacts().then((c) => setTotalContacts(c.length)).catch(() => {})
  }, [])

  // track the preview column's real width to scale the email to fit
  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setPreviewWidth(entries[0]?.contentRect.width ?? 0)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const set = <K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]) =>
    setD((prev) => ({ ...prev, [k]: v }))

  const previewHtml = useMemo(() => buildCampaignHtml(d), [d])

  const recipientCount =
    d.target === 'all'
      ? totalContacts
      : d.target === 'group'
        ? groups.find((g) => g.id === d.group_id)?.member_count ?? 0
        : d.individual_email
          ? 1
          : 0

  const onImage = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const url = await uploadCampaignImage(file)
      set('image_url', url)
    } catch {
      setError('No se pudo subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

  const persist = async (): Promise<string> => {
    const saved = await saveCampaign(d, campaignId ?? undefined)
    setCampaignId(saved.id)
    return saved.id
  }

  const onSaveDraft = async () => {
    if (!d.subject.trim()) {
      setError('Ponle un asunto a la campaña.')
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await persist()
      setNotice('Borrador guardado.')
    } catch {
      setError('No se pudo guardar el borrador.')
    } finally {
      setSaving(false)
    }
  }

  const validateBeforeSend = (): string | null => {
    if (!d.subject.trim()) return 'Ponle un asunto a la campaña.'
    if (d.target === 'group' && !d.group_id) return 'Elige un grupo.'
    if (d.target === 'individual' && !d.individual_email?.trim())
      return 'Escribe el correo individual.'
    if (recipientCount === 0) return 'No hay destinatarios para este envío.'
    return null
  }

  const doSend = async () => {
    setConfirm(false)
    setSending(true)
    setError(null)
    setNotice(null)
    try {
      const id = await persist()
      await sendCampaign(id)
      // poll status until terminal
      let tries = 0
      const poll = async () => {
        const c = await fetchCampaign(id)
        if (!c) return
        if (c.status === 'sent') {
          setNotice(`¡Enviado! ${c.recipients_count} destinatario(s).`)
          setSending(false)
          onSent()
        } else if (c.status === 'failed') {
          setError(`Falló el envío: ${c.error ?? 'error desconocido'}`)
          setSending(false)
        } else if (tries++ < 40) {
          setTimeout(poll, 3000)
        } else {
          setNotice('El envío está en proceso. Revisa el historial en un momento.')
          setSending(false)
          onSent()
        }
      }
      setNotice('Enviando… esto puede tardar un momento para listas grandes.')
      setTimeout(poll, 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar.')
      setSending(false)
    }
  }

  const onSendClick = () => {
    const v = validateBeforeSend()
    if (v) {
      setError(v)
      return
    }
    setConfirm(true)
  }

  const onTest = async () => {
    if (!d.subject.trim()) {
      setError('Ponle un asunto antes de enviar la prueba.')
      return
    }
    const to = session?.user.email
    if (!to) return
    setTesting(true)
    setError(null)
    setNotice(null)
    try {
      const id = await persist()
      await sendCampaignTest(id, to)
      setNotice(`Prueba enviada a ${to}. Revisa tu bandeja (y Promociones).`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la prueba.')
    } finally {
      setTesting(false)
    }
  }

  const targetLabel =
    d.target === 'all'
      ? `TODOS (${totalContacts})`
      : d.target === 'group'
        ? `GRUPO: ${groups.find((g) => g.id === d.group_id)?.name ?? '—'} (${recipientCount})`
        : `INDIVIDUAL: ${d.individual_email ?? ''}`

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
      {/* form */}
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-5">
          <h2 className="noid-label">EL CORREO</h2>

          <div className="flex flex-col gap-2">
            <label htmlFor="c-subject" className={labelClass}>Asunto</label>
            <input id="c-subject" value={d.subject} onChange={(e) => set('subject', e.target.value)} className={inputClass} placeholder="🚨 HOY EN RADIO BERLÍN…" />
          </div>

          {/* image */}
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Imagen / flyer</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="group relative flex min-h-[160px] w-full items-center justify-center overflow-hidden border border-white/10 transition-colors hover:border-white/30"
            >
              {d.image_url ? (
                <img src={d.image_url} alt="" className="max-h-64 w-full object-contain" />
              ) : null}
              <span className="relative z-10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/60 group-hover:text-white">
                {uploading ? 'SUBIENDO…' : d.image_url ? 'CAMBIAR IMAGEN' : 'SUBIR IMAGEN'}
              </span>
            </button>
            {d.image_url && (
              <button type="button" onClick={() => set('image_url', null)} className="self-start text-[9px] uppercase tracking-[0.25em] text-white/30 hover:text-accent">
                Quitar imagen
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImage(f); e.target.value = '' }} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="c-heading" className={labelClass}>Título</label>
            <input id="c-heading" value={d.heading ?? ''} onChange={(e) => set('heading', e.target.value)} className={inputClass} placeholder="🚨 HOY EN RADIO BERLÍN" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="c-tagline" className={labelClass}>Subtítulo (rojo, opcional)</label>
            <input id="c-tagline" value={d.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} className={inputClass} placeholder="Taller · Conversatorio · 3 live acts" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="c-body" className={labelClass}>Información (mensaje)</label>
            <textarea id="c-body" rows={8} value={d.body ?? ''} onChange={(e) => set('body', e.target.value)} className={inputClass} placeholder={'Escribe tu mensaje.\n\nDeja una línea en blanco entre párrafos.'} />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="c-cta" className={labelClass}>Texto del botón</label>
              <input id="c-cta" value={d.cta_label ?? ''} onChange={(e) => set('cta_label', e.target.value)} className={inputClass} placeholder="Comprar entradas →" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="c-ctaurl" className={labelClass}>Link del botón</label>
              <input id="c-ctaurl" type="url" value={d.cta_url ?? ''} onChange={(e) => set('cta_url', e.target.value)} className={inputClass} placeholder="https://…" />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="noid-label">REMITENTE</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="c-fromname" className={labelClass}>Nombre del remitente</label>
              <input id="c-fromname" value={d.from_name} onChange={(e) => set('from_name', e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="c-fromemail" className={labelClass}>Correo (@noidentityrecords.com)</label>
              <input id="c-fromemail" value={d.from_email} onChange={(e) => set('from_email', e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="c-replyto" className={labelClass}>Responder a</label>
            <input id="c-replyto" type="email" value={d.reply_to ?? ''} onChange={(e) => set('reply_to', e.target.value)} className={inputClass} placeholder="noid.colombia@gmail.com" />
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="noid-label">DESTINATARIOS</h2>
          <div className="flex flex-wrap gap-3">
            {(['all', 'group', 'individual'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('target', t)}
                aria-pressed={d.target === t}
                className={`border px-4 py-2 text-[11px] uppercase tracking-[0.2em] transition-colors ${d.target === t ? 'border-white bg-white text-black' : 'border-white/20 text-white/70 hover:border-white/50'}`}
              >
                {t === 'all' ? 'Todos' : t === 'group' ? 'Un grupo' : 'Individual'}
              </button>
            ))}
          </div>
          {d.target === 'group' && (
            <select value={d.group_id ?? ''} onChange={(e) => set('group_id', e.target.value || null)} className={inputClass}>
              <option value="">Elige un grupo…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name} ({g.member_count})</option>
              ))}
            </select>
          )}
          {d.target === 'individual' && (
            <input type="email" value={d.individual_email ?? ''} onChange={(e) => set('individual_email', e.target.value)} className={inputClass} placeholder="correo@ejemplo.com" />
          )}
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
            Se enviará a <span className="text-accent">{recipientCount}</span> destinatario(s){' '}
            <span className="text-white/30">(sin duplicados)</span>.
          </p>
        </section>

        {error && <p role="alert" className="text-xs tracking-[0.1em] text-accent">{error}</p>}
        {notice && <p role="status" className="text-xs tracking-[0.1em] text-white/60">{notice}</p>}

        <div className="flex flex-wrap gap-4 border-t border-white/5 pt-6">
          <button type="button" onClick={() => void onSaveDraft()} disabled={saving || sending} className="px-6 py-4 font-display text-[11px] uppercase tracking-[0.3em] text-white/50 transition-colors hover:text-white disabled:opacity-40">
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button type="button" onClick={onSendClick} disabled={sending} className="noid-button disabled:opacity-40">
            {sending ? 'Enviando…' : 'Enviar campaña'}
          </button>
        </div>
      </div>

      {/* live preview */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-28 lg:h-fit">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="noid-label">VISTA PREVIA</h2>
          <div className="flex items-center gap-2" role="group" aria-label="Modo de vista previa">
            {(['desktop', 'mobile'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPreviewMode(m)}
                aria-pressed={previewMode === m}
                className={`border px-3 py-1.5 text-[9px] uppercase tracking-[0.25em] transition-colors ${
                  previewMode === m
                    ? 'border-white bg-white text-black'
                    : 'border-white/20 text-white/60 hover:border-white/50'
                }`}
              >
                {m === 'desktop' ? 'Escritorio' : 'Móvil'}
              </button>
            ))}
          </div>
        </div>

        {/* inbox mock: how it looks BEFORE opening */}
        <div className="flex items-center gap-3 border border-white/10 bg-white/[0.03] px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-display text-[13px] font-bold text-black">
            {(d.from_name || 'N').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] text-white">
              <span className="font-bold">{d.from_name || 'Remitente'}</span>
              <span className="ml-2 text-[10px] text-white/35">{d.from_email}</span>
            </p>
            <p className="truncate text-[12px] font-semibold text-white/90">
              {d.subject || 'Asunto del correo…'}
            </p>
            <p className="truncate text-[11px] text-white/40">
              {(d.body ?? '').split('\n').find(Boolean) ?? 'El inicio de tu mensaje se ve aquí…'}
            </p>
          </div>
        </div>

        {/* real-size render, scaled to fit the column */}
        <div
          ref={previewRef}
          className="overflow-hidden border border-white/10 bg-[#0a0a0a]"
          style={{ height: 620 }}
        >
          {(() => {
            const baseW = previewMode === 'desktop' ? 632 : 400
            const scale = previewWidth > 0 ? Math.min(1, previewWidth / baseW) : 1
            return (
              <div className={previewMode === 'mobile' ? 'flex justify-center' : undefined}>
                <iframe
                  title="Vista previa del correo"
                  srcDoc={previewHtml}
                  sandbox=""
                  style={{
                    width: baseW,
                    height: 620 / scale,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    border: 0,
                    display: 'block',
                  }}
                />
              </div>
            )
          })()}
        </div>

        <button
          type="button"
          onClick={() => void onTest()}
          disabled={testing || sending}
          className="noid-button self-start disabled:opacity-40"
        >
          {testing ? 'Enviando prueba…' : 'Enviarme una prueba'}
        </button>
        <p className="text-[9px] uppercase leading-relaxed tracking-[0.2em] text-white/35">
          Te llega el correo real a {session?.user.email ?? 'tu bandeja'} con el
          asunto [PRUEBA] — sin tocar a los contactos.
        </p>
      </div>

      <ConfirmDialog
        open={confirm}
        title="ENVIAR CAMPAÑA"
        copy={`Se enviará "${d.subject}" a ${targetLabel}. Esta acción no se puede deshacer.`}
        confirmLabel={`Enviar a ${recipientCount}`}
        onConfirm={() => void doSend()}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}
