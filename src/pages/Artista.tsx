import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import ArtistThumb from '../components/artists/ArtistThumb'
import { useAuth } from '../lib/auth'
import { fetchArtistBySlug, soundcloudEmbedUrl, type Artist } from '../lib/artists'

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notfound' }
  | { status: 'ready'; artist: Artist }

export default function ArtistaPage() {
  const { slug } = useParams<{ slug: string }>()
  const { session } = useAuth()
  const [load, setLoad] = useState<Load>({ status: 'loading' })

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoad({ status: 'loading' })
    fetchArtistBySlug(slug)
      .then((artist) => {
        if (!cancelled) setLoad(artist ? { status: 'ready', artist } : { status: 'notfound' })
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
    // owners can see their own pending profile — re-fetch once the session resolves
  }, [slug, session?.user.id])

  useEffect(() => {
    if (load.status === 'ready') document.title = `${load.artist.name} — NO.IDENTITY RECORDS`
  }, [load])

  if (load.status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status">
        <p className="noid-label animate-pulse">CARGANDO</p>
      </div>
    )
  }
  if (load.status === 'notfound') {
    return (
      <EmptyState
        label="ARTISTAS"
        title="ESTE PERFIL NO EXISTE"
        copy="EL ARTISTA QUE BUSCAS NO ESTÁ EN EL CATÁLOGO O FUE RETIRADO."
      >
        <Link to="/artistas" className="noid-button mt-4">
          Ver todos los artistas
        </Link>
      </EmptyState>
    )
  }
  if (load.status === 'error') {
    return (
      <EmptyState
        label="ARTISTAS"
        title="ALGO SALIÓ MAL"
        copy="NO PUDIMOS CARGAR ESTE PERFIL. REVISA TU CONEXIÓN E INTENTA DE NUEVO."
      />
    )
  }

  const { artist } = load
  const isOwner = !!session && artist.user_id === session.user.id
  const unclaimed = artist.user_id === null && artist.status === 'approved'

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 pb-28 pt-12 md:pt-20">
      <Link
        to="/artistas"
        className="text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
      >
        ← Todos los artistas
      </Link>

      {artist.status !== 'approved' && (
        <div className="noid-card flex flex-col items-center gap-2 p-5 text-center">
          <p className="noid-label text-accent">
            {artist.status === 'pending' ? 'EN REVISIÓN' : 'OCULTO'}
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
            {artist.status === 'pending'
              ? 'Solo tú ves este perfil hasta que el sello lo apruebe.'
              : 'El sello ocultó este perfil del catálogo.'}
          </p>
        </div>
      )}

      <section className="grid gap-10 md:grid-cols-[minmax(0,320px)_1fr] md:gap-14">
        <ArtistThumb
          name={artist.name}
          imageUrl={artist.image_url}
          className="w-full max-w-sm border border-white/5"
        />
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <p className="noid-label">ARTISTA</p>
            <h1 className="noid-title text-2xl leading-tight text-white md:text-4xl">{artist.name}</h1>
            {(artist.subtitle || artist.city) && (
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                {[artist.subtitle, artist.city].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {artist.bio && (
            <p className="whitespace-pre-line text-sm leading-loose tracking-[0.05em] text-white/70">
              {artist.bio}
            </p>
          )}

          {artist.links.length > 0 && (
            <ul aria-label="Links" className="flex flex-wrap gap-3">
              {artist.links.map((l, i) => (
                <li key={`${l.url}-${i}`}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-block border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-white/70 transition-colors hover:border-white/50 hover:text-white"
                  >
                    {l.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}

          {artist.documents.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="noid-label">DOCUMENTOS</h2>
              <ul className="flex flex-col gap-2">
                {artist.documents.map((d, i) => (
                  <li key={`${d.url}-${i}`}>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-[11px] uppercase tracking-[0.2em] text-accent transition-opacity hover:opacity-70"
                    >
                      {d.label} ↓
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(isOwner || unclaimed) && (
            <div className="border-t border-white/5 pt-6">
              {isOwner ? (
                <Link
                  to="/perfil/artista"
                  className="text-[10px] uppercase tracking-[0.3em] text-accent transition-opacity hover:opacity-70"
                >
                  Editar mi perfil →
                </Link>
              ) : (
                <Link
                  to={`/perfil/artista?vincular=${encodeURIComponent(artist.slug)}`}
                  className="text-[10px] uppercase tracking-[0.3em] text-white/50 transition-colors hover:text-white"
                >
                  ¿Eres {artist.name}? Vincula este perfil a tu cuenta →
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {artist.tracks.length > 0 && (
        <section aria-label="Música" className="flex flex-col gap-6">
          <h2 className="noid-label pl-1">MÚSICA</h2>
          <ul className="flex flex-col gap-4">
            {artist.tracks.map((t, i) => (
              <li key={`${t.url}-${i}`} className="noid-card overflow-hidden">
                <iframe
                  src={soundcloudEmbedUrl(t.url)}
                  title={t.title || `${artist.name} en SoundCloud`}
                  loading="lazy"
                  scrolling="no"
                  width="100%"
                  height={166}
                  style={{ border: 0, display: 'block' }}
                  allow="autoplay"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
