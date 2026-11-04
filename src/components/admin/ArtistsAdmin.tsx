import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../ConfirmDialog'
import ArtistForm from '../artists/ArtistForm'
import ArtistThumb from '../artists/ArtistThumb'
import { useAuth } from '../../lib/auth'
import {
  EMPTY_ARTIST,
  artistErrorMessage,
  createArtistAdmin,
  deleteArtist,
  fetchAllArtistsAdmin,
  fetchPendingClaims,
  foldText,
  reviewClaim,
  setArtistStatus,
  toArtistInput,
  unlinkArtistOwner,
  updateArtist,
  type AdminArtist,
  type PendingClaim,
} from '../../lib/artists'

const actionBtn =
  'text-[10px] uppercase tracking-[0.25em] text-white/50 transition-colors hover:text-white disabled:opacity-40'

const STATUS_LABEL: Record<AdminArtist['status'], string> = {
  approved: 'Visible',
  pending: 'Por aprobar',
  hidden: 'Oculto',
}

/** Gestión → Artistas: claim requests, profiles awaiting approval, and the
 *  full catalog (create, edit, hide/show, unlink owner, delete). */
export default function ArtistsAdmin() {
  const { session } = useAuth()
  const [artists, setArtists] = useState<AdminArtist[] | null>(null)
  const [claims, setClaims] = useState<PendingClaim[]>([])
  const [loadError, setLoadError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminArtist | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<AdminArtist | null>(null)
  const [q, setQ] = useState('')

  const reload = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([fetchAllArtistsAdmin(), fetchPendingClaims()])
      setArtists(a)
      setClaims(c)
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    setError(null)
    try {
      await fn()
      await reload()
    } catch (e) {
      setError(artistErrorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const pendingProfiles = useMemo(
    () => (artists ?? []).filter((a) => a.status === 'pending'),
    [artists],
  )
  const catalog = useMemo(() => {
    const needle = foldText(q.trim())
    const rest = (artists ?? []).filter((a) => a.status !== 'pending')
    return needle ? rest.filter((a) => foldText(a.name).includes(needle)) : rest
  }, [artists, q])

  const editInitial = useMemo(
    () => (editing && editing !== 'new' ? toArtistInput(editing) : EMPTY_ARTIST),
    [editing],
  )

  if (!session) return null
  if (loadError) {
    return (
      <p role="alert" className="text-xs tracking-[0.15em] text-white/60">
        NO PUDIMOS CARGAR LOS ARTISTAS. RECARGA LA PÁGINA.
      </p>
    )
  }
  if (artists === null) {
    return (
      <p className="noid-label animate-pulse py-8 text-center" role="status">
        CARGANDO
      </p>
    )
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <p className="noid-label">{editing === 'new' ? 'NUEVO ARTISTA' : `EDITAR · ${editing.name}`}</p>
          {editing !== 'new' && (
            <Link to={`/artistas/${editing.slug}`} className={actionBtn} target="_blank">
              Ver perfil ↗
            </Link>
          )}
        </div>
        <ArtistForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editInitial}
          uploaderId={session.user.id}
          submitLabel={editing === 'new' ? 'Crear artista' : 'Guardar cambios'}
          onCancel={() => setEditing(null)}
          onSubmit={async (input) => {
            if (editing === 'new') await createArtistAdmin(input)
            else await updateArtist(editing.id, input)
            await reload()
            setEditing(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-14">
      {error && (
        <p role="alert" className="text-xs tracking-[0.1em] text-accent">
          {error}
        </p>
      )}

      {/* claim requests */}
      <section className="flex flex-col gap-5" aria-label="Solicitudes de vinculación">
        <h2 className="noid-label">
          SOLICITUDES DE VINCULACIÓN {claims.length > 0 && <span className="text-accent">· {claims.length}</span>}
        </h2>
        {claims.length === 0 ? (
          <p className="text-[11px] tracking-[0.1em] text-white/40">Sin solicitudes pendientes.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {claims.map((c) => (
              <li key={c.id} className="noid-card flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                <ArtistThumb name={c.artist_name} imageUrl={c.artist_image} className="w-16 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="text-xs uppercase tracking-[0.15em] text-white">
                    <Link to={`/artistas/${c.artist_slug}`} target="_blank" className="hover:underline">
                      {c.artist_name}
                    </Link>
                  </p>
                  <p className="break-all text-[11px] tracking-[0.05em] text-white/60">
                    Solicita: {c.display_name || 'Sin nombre'} · {c.email ?? '—'}
                  </p>
                  {c.message && (
                    <p className="whitespace-pre-line text-[11px] leading-relaxed tracking-[0.05em] text-white/50">
                      “{c.message}”
                    </p>
                  )}
                  <p className="text-[9px] uppercase tracking-[0.25em] text-white/30">
                    {new Date(c.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-5">
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void run(c.id, () => reviewClaim(c.id, true))}
                    className={`${actionBtn} text-accent hover:text-white`}
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void run(c.id, () => reviewClaim(c.id, false))}
                    className={actionBtn}
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* self-created profiles awaiting approval */}
      {pendingProfiles.length > 0 && (
        <section className="flex flex-col gap-5" aria-label="Perfiles por aprobar">
          <h2 className="noid-label">
            PERFILES NUEVOS POR APROBAR <span className="text-accent">· {pendingProfiles.length}</span>
          </h2>
          <ul className="flex flex-col gap-3">
            {pendingProfiles.map((a) => (
              <ArtistRow
                key={a.id}
                artist={a}
                busy={busyId !== null}
                onEdit={() => setEditing(a)}
                actions={
                  <>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void run(a.id, () => setArtistStatus(a.id, 'approved'))}
                      className={`${actionBtn} text-accent hover:text-white`}
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void run(a.id, () => setArtistStatus(a.id, 'hidden'))}
                      className={actionBtn}
                    >
                      Rechazar
                    </button>
                  </>
                }
              />
            ))}
          </ul>
        </section>
      )}

      {/* catalog */}
      <section className="flex flex-col gap-5" aria-label="Catálogo de artistas">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="noid-label">CATÁLOGO · {catalog.length}</h2>
          <button type="button" onClick={() => setEditing('new')} className="noid-button self-start">
            + Nuevo artista
          </button>
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="BUSCAR"
          aria-label="Buscar artista"
          className="w-full border border-white/10 bg-transparent px-4 py-3 text-xs uppercase tracking-[0.2em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none"
        />
        <ul className="flex flex-col gap-3">
          {catalog.map((a) => (
            <ArtistRow
              key={a.id}
              artist={a}
              busy={busyId !== null}
              onEdit={() => setEditing(a)}
              actions={
                <>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() =>
                      void run(a.id, () =>
                        setArtistStatus(a.id, a.status === 'approved' ? 'hidden' : 'approved'),
                      )
                    }
                    className={actionBtn}
                  >
                    {a.status === 'approved' ? 'Ocultar' : 'Mostrar'}
                  </button>
                  {a.user_id && (
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void run(a.id, () => unlinkArtistOwner(a.id))}
                      className={actionBtn}
                    >
                      Desvincular
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => setToDelete(a)}
                    className={actionBtn}
                  >
                    Eliminar
                  </button>
                </>
              }
            />
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        title="ELIMINAR ARTISTA"
        copy={`Se borrará el perfil de ${toDelete?.name ?? ''} del catálogo. Si solo quieres sacarlo de la vista pública, usa Ocultar.`}
        confirmLabel="Eliminar"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const a = toDelete
          setToDelete(null)
          if (a) void run(a.id, () => deleteArtist(a.id))
        }}
      />
    </div>
  )
}

function ArtistRow({
  artist,
  busy,
  onEdit,
  actions,
}: {
  artist: AdminArtist
  busy: boolean
  onEdit: () => void
  actions: ReactNode
}) {
  return (
    <li className="noid-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <ArtistThumb name={artist.name} imageUrl={artist.image_url} className="w-14 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          to={`/artistas/${artist.slug}`}
          target="_blank"
          className="truncate text-xs uppercase tracking-[0.15em] text-white hover:underline"
        >
          {artist.name}
        </Link>
        <p className="truncate text-[9px] uppercase tracking-[0.2em] text-white/40">
          <span className={artist.status === 'approved' ? '' : 'text-accent'}>
            {STATUS_LABEL[artist.status]}
          </span>
          {' · '}
          {artist.user_id ? `Vinculado: ${artist.owner?.display_name || 'cuenta sin nombre'}` : 'Sin vincular'}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-5">
        <button type="button" disabled={busy} onClick={onEdit} className={actionBtn}>
          Editar
        </button>
        {actions}
      </div>
    </li>
  )
}
