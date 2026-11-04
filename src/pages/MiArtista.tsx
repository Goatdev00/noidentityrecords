import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ArtistForm from '../components/artists/ArtistForm'
import ArtistThumb from '../components/artists/ArtistThumb'
import { useAuth } from '../lib/auth'
import {
  EMPTY_ARTIST,
  artistErrorMessage,
  cancelClaim,
  createMyArtist,
  fetchClaimable,
  fetchMyArtist,
  fetchMyClaims,
  foldText,
  submitClaim,
  toArtistInput,
  updateArtist,
  type Artist,
  type ArtistCard,
  type ArtistInput,
  type MyClaim,
} from '../lib/artists'

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; artist: Artist | null; claims: MyClaim[] }

const STATUS_COPY: Record<Artist['status'], { label: string; copy: string }> = {
  approved: { label: 'PUBLICADO', copy: 'Tu perfil está visible en el catálogo de artistas.' },
  pending: {
    label: 'EN REVISIÓN',
    copy: 'El sello revisará tu perfil antes de publicarlo. Mientras tanto puedes seguir editándolo.',
  },
  hidden: { label: 'OCULTO', copy: 'El sello ocultó tu perfil del catálogo. Escríbenos si crees que es un error.' },
}

export default function MiArtista() {
  const { session, profile } = useAuth()
  const [params] = useSearchParams()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [mode, setMode] = useState<'choose' | 'claim' | 'create'>(
    params.get('vincular') ? 'claim' : 'choose',
  )
  const uid = session?.user.id

  const reload = useCallback(async () => {
    if (!uid) return
    try {
      const [artist, claims] = await Promise.all([fetchMyArtist(uid), fetchMyClaims()])
      setLoad({ status: 'ready', artist, claims })
    } catch {
      setLoad({ status: 'error' })
    }
  }, [uid])

  useEffect(() => {
    void reload()
  }, [reload])

  if (!session || !uid) return null // RequireAuth gates the route

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col gap-4">
        <Link
          to="/perfil"
          className="text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
        >
          ← Mi perfil
        </Link>
        <p className="noid-label">PERFIL DE ARTISTA</p>
        <h1 className="noid-title text-lg leading-relaxed text-white md:text-2xl">
          TU LUGAR EN EL CATÁLOGO
        </h1>
      </header>

      {load.status === 'loading' ? (
        <p className="noid-label animate-pulse py-12 text-center" role="status">
          CARGANDO
        </p>
      ) : load.status === 'error' ? (
        <p role="alert" className="text-xs tracking-[0.15em] text-white/60">
          NO PUDIMOS CARGAR TU PERFIL. RECARGA LA PÁGINA.
        </p>
      ) : load.artist ? (
        <OwnArtist artist={load.artist} uid={uid} onSaved={(a) => setLoad({ ...load, artist: a })} />
      ) : (
        <NoArtistYet
          uid={uid}
          claims={load.claims}
          mode={mode}
          setMode={setMode}
          preselect={params.get('vincular')}
          defaultName={profile?.display_name ?? ''}
          defaultPhoto={profile?.avatar_url ?? null}
          onChanged={reload}
        />
      )}
    </div>
  )
}

function OwnArtist({
  artist,
  uid,
  onSaved,
}: {
  artist: Artist
  uid: string
  onSaved: (a: Artist) => void
}) {
  const initial = useMemo(() => toArtistInput(artist), [artist.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const s = STATUS_COPY[artist.status]
  return (
    <div className="flex flex-col gap-10">
      <div className="noid-card flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className={`noid-label ${artist.status === 'approved' ? '' : 'text-accent'}`}>{s.label}</p>
          <p className="text-[11px] leading-relaxed tracking-[0.1em] text-white/60">{s.copy}</p>
        </div>
        <Link
          to={`/artistas/${artist.slug}`}
          className="shrink-0 text-[10px] uppercase tracking-[0.3em] text-white/60 transition-colors hover:text-white"
        >
          Ver perfil →
        </Link>
      </div>
      <ArtistForm
        key={artist.id}
        initial={initial}
        uploaderId={uid}
        submitLabel="Guardar perfil"
        onSubmit={async (input) => onSaved(await updateArtist(artist.id, input))}
      />
    </div>
  )
}

function NoArtistYet({
  uid,
  claims,
  mode,
  setMode,
  preselect,
  defaultName,
  defaultPhoto,
  onChanged,
}: {
  uid: string
  claims: MyClaim[]
  mode: 'choose' | 'claim' | 'create'
  setMode: (m: 'choose' | 'claim' | 'create') => void
  preselect: string | null
  defaultName: string
  defaultPhoto: string | null
  onChanged: () => Promise<void>
}) {
  const pending = claims.find((c) => c.status === 'pending')
  const lastRejected = claims.find((c) => c.status === 'rejected')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createInitial = useMemo<ArtistInput>(
    () => ({ ...EMPTY_ARTIST, name: defaultName, image_url: defaultPhoto }),
    // seeded once; later profile refreshes must not wipe what the user typed
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (pending) {
    return (
      <div className="noid-card flex flex-col items-center gap-5 p-10 text-center">
        <p className="noid-label text-accent">SOLICITUD EN REVISIÓN</p>
        <p className="max-w-md text-xs leading-loose tracking-[0.15em] text-white/60">
          PEDISTE VINCULAR EL PERFIL DE{' '}
          <span className="text-white">{pending.artist?.name ?? 'UN ARTISTA'}</span> A TU CUENTA. EL
          SELLO LA REVISARÁ PRONTO.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              await cancelClaim(pending.id)
              await onChanged()
            } catch (e) {
              setError(artistErrorMessage(e))
            } finally {
              setBusy(false)
            }
          }}
          className="text-[10px] uppercase tracking-[0.3em] text-white/50 transition-colors hover:text-white disabled:opacity-40"
        >
          Cancelar solicitud
        </button>
        {error && (
          <p role="alert" className="text-xs tracking-[0.1em] text-accent">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {lastRejected && (
        <p className="noid-card p-5 text-[11px] leading-relaxed tracking-[0.1em] text-white/60">
          Tu solicitud para vincular <span className="text-white">{lastRejected.artist?.name ?? 'un perfil'}</span>{' '}
          no fue aprobada. Si crees que es un error, escríbenos desde Contacto.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2" role="group" aria-label="¿Cómo quieres empezar?">
        {(
          [
            ['claim', 'Ya estoy en el catálogo', 'Busca tu perfil y pide vincularlo a tu cuenta.'],
            ['create', 'Crear perfil nuevo', 'Arma tu perfil desde cero. El sello lo aprueba.'],
          ] as const
        ).map(([m, title, copy]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`flex flex-col gap-3 border p-6 text-left transition-colors ${
              mode === m ? 'border-white bg-white/[0.04]' : 'border-white/10 hover:border-white/40'
            }`}
          >
            <span className="font-display text-[11px] uppercase tracking-[0.25em] text-white">{title}</span>
            <span className="text-[11px] leading-relaxed tracking-[0.05em] text-white/50">{copy}</span>
          </button>
        ))}
      </div>

      {mode === 'claim' && <ClaimFlow preselect={preselect} onSubmitted={onChanged} />}
      {mode === 'create' && (
        <div className="flex flex-col gap-6">
          <p className="text-[11px] leading-relaxed tracking-[0.1em] text-white/50">
            Tu perfil se publicará en el catálogo cuando el sello lo apruebe.
          </p>
          <ArtistForm
            initial={createInitial}
            uploaderId={uid}
            submitLabel="Crear mi perfil"
            onSubmit={async (input) => {
              await createMyArtist(input)
              await onChanged()
            }}
          />
        </div>
      )}
    </div>
  )
}

function ClaimFlow({
  preselect,
  onSubmitted,
}: {
  preselect: string | null
  onSubmitted: () => Promise<void>
}) {
  const [list, setList] = useState<ArtistCard[] | null>(null)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<ArtistCard | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchClaimable()
      .then((l) => {
        if (cancelled) return
        setList(l)
        if (preselect) setPicked(l.find((a) => a.slug === preselect) ?? null)
      })
      .catch(() => {
        if (!cancelled) setList([])
      })
    return () => {
      cancelled = true
    }
  }, [preselect])

  const results = useMemo(() => {
    const needle = foldText(q.trim())
    if (!list || !needle) return []
    return list.filter((a) => foldText(a.name).includes(needle)).slice(0, 8)
  }, [list, q])

  if (list === null) {
    return (
      <p className="noid-label animate-pulse py-8 text-center" role="status">
        CARGANDO
      </p>
    )
  }

  if (picked) {
    return (
      <form
        className="flex flex-col gap-6"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError(null)
          try {
            await submitClaim(picked.id, message)
            await onSubmitted()
          } catch (err) {
            setError(artistErrorMessage(err))
            setBusy(false)
          }
        }}
      >
        <div className="noid-card flex items-center gap-5 p-4">
          <ArtistThumb name={picked.name} imageUrl={picked.image_url} className="w-20 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs uppercase tracking-[0.15em] text-white">{picked.name}</p>
            {picked.subtitle && (
              <p className="mt-1 truncate text-[9px] uppercase tracking-[0.2em] text-white/40">
                {picked.subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="shrink-0 text-[10px] uppercase tracking-[0.25em] text-white/50 hover:text-white"
          >
            Cambiar
          </button>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">
            ¿Cómo verificamos que eres tú?
          </span>
          <textarea
            value={message}
            maxLength={1000}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tu Instagram o SoundCloud, un correo de booking, con quién hablaste en No.ID…"
            className="min-h-28 w-full border border-white/10 bg-transparent px-4 py-3 text-sm leading-relaxed tracking-[0.05em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none"
          />
        </label>
        <div className="flex flex-col gap-3">
          <button type="submit" disabled={busy} className="noid-button self-start disabled:opacity-40">
            {busy ? 'Enviando…' : 'Solicitar vinculación'}
          </button>
          {error && (
            <p role="alert" className="text-xs tracking-[0.1em] text-accent">
              {error}
            </p>
          )}
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <label>
        <span className="sr-only">Busca tu nombre artístico</span>
        <input
          type="search"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
          placeholder="BUSCA TU NOMBRE ARTÍSTICO"
          className="w-full border border-white/10 bg-transparent px-4 py-3 text-xs uppercase tracking-[0.2em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none"
        />
      </label>
      {q.trim() && results.length === 0 && (
        <p className="text-[11px] leading-relaxed tracking-[0.1em] text-white/50">
          No encontramos perfiles libres con ese nombre. Puede que ya esté vinculado, o crea uno nuevo.
        </p>
      )}
      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setPicked(a)}
                className="flex w-full items-center gap-4 border border-white/10 p-3 text-left transition-colors hover:border-white/40"
              >
                <ArtistThumb name={a.name} imageUrl={a.image_url} className="w-12 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs uppercase tracking-[0.15em] text-white">
                  {a.name}
                </span>
                <span aria-hidden="true" className="text-white/30">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
