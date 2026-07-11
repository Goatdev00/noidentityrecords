import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import {
  buildEmbedUrl,
  createPodcast,
  deletePodcast,
  fetchPodcastsAdmin,
  updatePodcast,
  type AdminEmbed,
} from '../../lib/admin'

const inputClass =
  'w-full min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.05em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const labelClass = 'text-[10px] uppercase tracking-[0.3em] text-white/50'

function PodcastForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: AdminEmbed
  onSaved: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? 'Podcast Sessions')
  const [meta, setMeta] = useState(initial?.meta ?? '')
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = source ? buildEmbedUrl(source) : null

  const save = async () => {
    if (!initial && !source.trim()) return setError('Pega el enlace del podcast (SoundCloud).')
    if (source.trim() && !buildEmbedUrl(source))
      return setError('No reconocí el link. Pega la URL de SoundCloud del episodio.')
    setSaving(true)
    setError(null)
    try {
      if (initial) {
        await updatePodcast(initial.id, {
          title,
          meta,
          ...(source.trim() ? { source } : {}),
        })
      } else {
        await createPodcast({ title, meta: meta || null, source })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
      setSaving(false)
    }
  }

  return (
    <div className="noid-card flex flex-col gap-5 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className={labelClass}>Título</label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Podcast Sessions"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className={labelClass}>Invitado / artista</label>
          <input
            className={inputClass}
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            placeholder="Tepé"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass}>
          {initial ? 'Reemplazar enlace (opcional)' : 'Enlace de SoundCloud *'}
        </label>
        <input
          className={inputClass}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="https://soundcloud.com/noidcol/no-id-podcast-sessions-…"
        />
        <p className="text-[9px] uppercase leading-relaxed tracking-[0.2em] text-white/35">
          Pega el link del episodio en SoundCloud (o el código &lt;iframe&gt; de
          «Compartir → Insertar»). Se genera el reproductor automáticamente.
        </p>
      </div>

      {/* live player preview */}
      {preview && (
        <div className="border border-white/10">
          <iframe
            src={preview.embed_url}
            title="Vista previa del podcast"
            width="100%"
            height={preview.height}
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            scrolling="no"
          />
        </div>
      )}

      {error && <p className="text-xs tracking-[0.1em] text-accent">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => void save()} disabled={saving} className="noid-button disabled:opacity-40">
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Publicar podcast'}
        </button>
        <button onClick={onCancel} className="text-[10px] uppercase tracking-[0.25em] text-white/40 hover:text-white">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function PodcastAdmin() {
  const [items, setItems] = useState<AdminEmbed[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AdminEmbed | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const reload = () =>
    fetchPodcastsAdmin()
      .then(setItems)
      .catch(() => setItems([]))

  useEffect(() => {
    reload()
  }, [])

  const toggle = async (e: AdminEmbed) => {
    setBusy(e.id)
    try {
      await updatePodcast(e.id, { active: !e.active })
      await reload()
    } finally {
      setBusy(null)
    }
  }

  const onDelete = async () => {
    const t = pendingDelete
    setPendingDelete(null)
    if (!t) return
    await deletePodcast(t.id).catch(() => {})
    reload()
  }

  const activeCount = items?.filter((i) => i.active).length ?? 0

  return (
    <div ref={topRef} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="noid-label">PODCAST</h2>
          {items && (
            <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
              {activeCount} activos · la landing muestra 3, Record Label 4
              {activeCount < 3 && ' · sube al menos 3'}
            </p>
          )}
        </div>
        {!creating && !editing && (
          <button onClick={() => setCreating(true)} className="noid-button">
            + Nuevo episodio
          </button>
        )}
      </div>

      {creating && (
        <PodcastForm
          onSaved={() => {
            setCreating(false)
            reload()
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {items === null ? (
        <p className="noid-label animate-pulse py-8 text-center" role="status">
          CARGANDO
        </p>
      ) : items.length === 0 && !creating ? (
        <p className="py-8 text-center text-xs tracking-[0.15em] text-white/40">
          AÚN NO HAY PODCASTS. PUBLICA EL PRIMERO.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((e, i) =>
            editing === e.id ? (
              <li key={e.id}>
                <PodcastForm
                  initial={e}
                  onSaved={() => {
                    setEditing(null)
                    reload()
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li
                key={e.id}
                className="noid-card flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="w-6 shrink-0 text-center font-display text-sm text-white/30">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-[12px] uppercase tracking-[0.15em] text-white">
                      {e.title}
                      {e.meta && <span className="text-white/40"> · {e.meta}</span>}
                    </p>
                    <p className="mt-1 text-[10px] tracking-[0.15em] text-white/40">
                      {i === 0 && <span className="text-accent">ÚLTIMO · </span>}
                      {e.created_at.slice(0, 10)}
                      {!e.active && ' · OCULTO'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <button
                    onClick={() => void toggle(e)}
                    disabled={busy === e.id}
                    className="text-[9px] uppercase tracking-[0.25em] text-white/50 hover:text-white disabled:opacity-40"
                  >
                    {e.active ? 'Ocultar' : 'Mostrar'}
                  </button>
                  <button
                    onClick={() => setEditing(e.id)}
                    className="text-[9px] uppercase tracking-[0.25em] text-white/50 hover:text-white"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setPendingDelete(e)}
                    className="text-[9px] uppercase tracking-[0.25em] text-white/30 hover:text-accent"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="ELIMINAR PODCAST"
        copy={`SE ELIMINARÁ "${pendingDelete?.title}${pendingDelete?.meta ? ` · ${pendingDelete.meta}` : ''}". ESTA ACCIÓN NO SE PUEDE DESHACER.`}
        confirmLabel="Eliminar"
        onConfirm={() => void onDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
