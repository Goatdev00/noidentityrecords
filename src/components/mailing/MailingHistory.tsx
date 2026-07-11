import { useEffect, useState } from 'react'
import { deleteCampaign, fetchCampaigns, type Campaign } from '../../lib/mailing'

const STATUS: Record<Campaign['status'], { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'border-white/15 text-white/40' },
  queued: { label: 'En cola', cls: 'border-white/30 text-white/70' },
  sending: { label: 'Enviando', cls: 'border-white/30 text-white/70' },
  sent: { label: 'Enviado', cls: 'border-accent/40 text-accent' },
  failed: { label: 'Falló', cls: 'border-accent/60 text-accent' },
}

export default function MailingHistory({ refreshKey }: { refreshKey: number }) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCampaigns()
      .then((c) => !cancelled && setCampaigns(c))
      .catch(() => !cancelled && setCampaigns([]))
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (campaigns === null) {
    return (
      <p className="noid-label animate-pulse py-10 text-center" role="status">
        CARGANDO
      </p>
    )
  }
  if (campaigns.length === 0) {
    return (
      <p className="py-10 text-center text-xs tracking-[0.15em] text-white/40">
        AÚN NO HAS ENVIADO NINGUNA CAMPAÑA.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {campaigns.map((c) => {
        const s = STATUS[c.status]
        return (
          <li key={c.id} className="noid-card flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="min-w-0">
              <p className="truncate text-xs tracking-[0.05em] text-white">{c.subject || '(sin asunto)'}</p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.25em] text-white/35">
                {c.target === 'all' ? 'Todos' : c.target === 'group' ? 'Grupo' : 'Individual'}
                {c.status === 'sent' && ` · ${c.recipients_count} enviados`}
                {c.sent_at && ` · ${new Date(c.sent_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}`}
              </p>
              {c.status === 'failed' && c.error && (
                <p className="mt-1 text-[9px] tracking-[0.1em] text-accent">{c.error}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <span className={`border px-3 py-1 text-[9px] uppercase tracking-[0.3em] ${s.cls}`}>{s.label}</span>
              {(c.status === 'draft' || c.status === 'failed') && (
                <button
                  type="button"
                  onClick={() =>
                    deleteCampaign(c.id).then(() => setCampaigns((p) => (p ?? []).filter((x) => x.id !== c.id))).catch(() => {})
                  }
                  className="text-[9px] uppercase tracking-[0.25em] text-white/30 transition-colors hover:text-accent"
                >
                  Eliminar
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
