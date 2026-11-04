import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ArtistThumb from '../components/artists/ArtistThumb'
import { foldText, fetchCatalog, type ArtistCard } from '../lib/artists'

export default function Artistas() {
  const [artists, setArtists] = useState<ArtistCard[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchCatalog()
      .then((a) => {
        if (!cancelled) setArtists(a)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const shown = useMemo(() => {
    if (!artists) return []
    const needle = foldText(q.trim())
    return needle ? artists.filter((a) => foldText(a.name).includes(needle)) : artists
  }, [artists, q])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col items-center gap-6 text-center">
        <p className="noid-label">CATÁLOGO</p>
        <h1 className="noid-title text-xl leading-relaxed text-white md:text-3xl">ARTISTAS</h1>
        <p className="max-w-xl text-xs leading-loose tracking-[0.15em] text-white/60">
          QUIENES HAN HECHO PARTE DE NO.ID: SESIONES, LANZAMIENTOS, RESIDENCIAS Y FIESTAS.
        </p>
        <Link
          to="/perfil/artista"
          className="text-[10px] uppercase tracking-[0.3em] text-accent transition-opacity hover:opacity-70"
        >
          ¿Eres artista? Crea o vincula tu perfil →
        </Link>
      </header>

      {failed ? (
        <div className="noid-card flex items-center justify-center p-12 text-center">
          <p role="alert" className="text-xs leading-loose tracking-[0.15em] text-white/60">
            NO PUDIMOS CARGAR EL CATÁLOGO. REVISA TU CONEXIÓN E INTENTA DE NUEVO.
          </p>
        </div>
      ) : artists === null ? (
        <p className="noid-label animate-pulse py-16 text-center" role="status">
          CARGANDO
        </p>
      ) : artists.length === 0 ? (
        <div className="noid-card flex items-center justify-center p-12 text-center">
          <p className="text-xs leading-loose tracking-[0.15em] text-white/60">
            MUY PRONTO PRESENTAREMOS A LOS ARTISTAS DEL COLECTIVO.
          </p>
        </div>
      ) : (
        <section aria-label="Artistas" className="flex flex-col gap-10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <label className="w-full sm:max-w-xs">
              <span className="sr-only">Buscar artista</span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="BUSCAR ARTISTA"
                className="w-full border border-white/10 bg-transparent px-4 py-3 text-xs uppercase tracking-[0.2em] text-white placeholder:text-white/25 transition-colors duration-300 focus:border-white/40 focus:outline-none"
              />
            </label>
            <p role="status" className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              {shown.length} {shown.length === 1 ? 'artista' : 'artistas'}
            </p>
          </div>

          {shown.length === 0 ? (
            <p className="py-12 text-center text-xs tracking-[0.15em] text-white/50">
              NINGÚN ARTISTA COINCIDE CON “{q.trim().toUpperCase()}”.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((a) => (
                <li key={a.id}>
                  <Link to={`/artistas/${a.slug}`} className="noid-card group flex h-full flex-col">
                    <ArtistThumb name={a.name} imageUrl={a.image_url} hover />
                    <div className="flex flex-col gap-1 px-4 py-4">
                      <p className="truncate text-[11px] uppercase tracking-[0.15em] text-white">
                        {a.name}
                      </p>
                      {a.subtitle && (
                        <p className="truncate text-[9px] uppercase tracking-[0.2em] text-white/40">
                          {a.subtitle}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
