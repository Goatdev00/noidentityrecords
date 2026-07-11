import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { WHATSAPP_CHANNEL } from '../lib/constants'

type Artist = {
  id: string
  name: string
  subtitle: string | null
  image_url: string | null
  links: { label: string; url: string }[]
}

function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.5a1.7 1.7 0 0 0 .3-.4.5.5 0 0 0 0-.4c0-.1-.6-1.4-.8-1.9s-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.1 5 5 0 0 0 1 2.7 11.4 11.4 0 0 0 4.4 3.9 14.5 14.5 0 0 0 1.5.5 3.5 3.5 0 0 0 1.6.1 2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  )
}

export default function Nosotros() {
  const [artists, setArtists] = useState<Artist[] | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('artists')
      .select('id, name, subtitle, image_url, links')
      .eq('active', true)
      .order('position')
      .then(({ data, error }) => {
        if (!cancelled) setArtists(error ? [] : ((data ?? []) as Artist[]))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-24 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col items-center gap-6 text-center">
        <h1 className="noid-title text-xl leading-relaxed text-white md:text-3xl">
          NOSOTROS
        </h1>
      </header>

      {/* misión */}
      <section id="mision" aria-label="Misión" className="flex scroll-mt-32 flex-col gap-8">
        <h2 className="noid-label pl-1">MISIÓN</h2>
        <div className="flex flex-col gap-6">
          <p className="text-sm leading-loose tracking-[0.05em] text-white/70">
            No.ID es una comunidad cultural y plataforma dedicada al desarrollo,
            gestión, distribución y expansión de la escena de la música
            electrónica. Nuestro propósito es crear espacios donde la música, el
            arte y las conexiones humanas impulsen el crecimiento de artistas,
            productores y público.
          </p>
          <p className="text-sm leading-loose tracking-[0.05em] text-white/70">
            Con sede en Bogotá, Colombia, No.ID integra un sello discográfico,
            una academia de formación y una línea de productos oficiales
            (merch), además de promover eventos, experiencias y proyectos que
            fortalecen la cultura electrónica.
          </p>
        </div>
        <a
          href={WHATSAPP_CHANNEL}
          target="_blank"
          rel="noopener noreferrer"
          className="noid-button flex items-center gap-3 self-start"
        >
          <WhatsAppIcon />
          Únete al canal de WhatsApp
        </a>
      </section>

      {/* artistas */}
      <section id="artistas" aria-label="Artistas" className="flex scroll-mt-32 flex-col gap-8">
        <h2 className="noid-label pl-1">ARTISTAS</h2>
        {artists === null ? (
          <p className="noid-label animate-pulse py-8 text-center" role="status">
            CARGANDO
          </p>
        ) : artists.length === 0 ? (
          <div className="noid-card flex items-center justify-center p-12 text-center">
            <p className="text-xs leading-loose tracking-[0.15em] text-white/60">
              MUY PRONTO PRESENTAREMOS A LOS ARTISTAS DEL COLECTIVO.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            {artists.map((a) => (
              <li key={a.id} className="noid-card flex flex-col">
                <div className="aspect-square w-full overflow-hidden bg-white/[0.02]">
                  {a.image_url ? (
                    <img
                      src={a.image_url}
                      alt={a.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <img src="/logo-noid-wordmark.png" alt="" className="w-16 opacity-10" />
                    </div>
                  )}
                </div>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
