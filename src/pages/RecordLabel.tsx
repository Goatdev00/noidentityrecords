import { useEffect, useState, type ReactNode } from 'react'
import AudioEmbed from '../components/AudioEmbed'
import {
  MEDIA_EMBEDS,
  OTHER_PLATFORMS,
  classifySection,
  type MediaEmbed,
} from '../data/mediaEmbeds'
import { supabase } from '../lib/supabase'

/** Section with the original left-aligned label treatment (tracking 0.8em, 40%). */
function Section({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-label={label} className="scroll-mt-32">
      <h2 className="noid-label mb-10 pl-2">{label}</h2>
      {children}
    </section>
  )
}

export default function RecordLabel() {
  // media_embeds is the source of truth (editable from the dashboard without
  // touching code); the static module is the fallback if the fetch fails
  const [embeds, setEmbeds] = useState<MediaEmbed[]>(MEDIA_EMBEDS)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('media_embeds')
      .select('id, platform, title, meta, embed_url, height, position, active, section')
      .eq('active', true)
      .order('position')
      .then(({ data, error }) => {
        if (!cancelled && !error && data && data.length > 0) {
          setEmbeds(
            data.map((r) => ({
              ...r,
              meta: r.meta ?? '',
              height: r.height ?? (r.platform === 'bandcamp' ? 654 : 280),
              section: classifySection(r),
            })) as MediaEmbed[],
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const bySection = (section: MediaEmbed['section']) =>
    embeds
      .filter((e) => e.active && e.section === section)
      .sort((a, b) => a.position - b.position)

  const bandcamp = bySection('bandcamp')
  const specials = bySection('specials')
  const podcast = bySection('podcast')

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-32 px-6 pb-28 pt-12 md:pt-20">
      <header className="flex flex-col items-center gap-6 text-center">
        <h1 className="noid-title text-xl leading-relaxed text-white md:text-3xl">
          RECORD LABEL
        </h1>
      </header>

      {bandcamp.length > 0 && (
        <Section id="bandcamp" label="BANDCAMP">
          <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-3">
            {bandcamp.map((e) => (
              <AudioEmbed key={e.id} embed={e} />
            ))}
          </div>
        </Section>
      )}

      {specials.length > 0 && (
        <Section id="specials" label="NO.ID SPECIALS">
          <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-3">
            {specials.map((e) => (
              <AudioEmbed key={e.id} embed={e} />
            ))}
          </div>
        </Section>
      )}

      {podcast.length > 0 && (
        <Section id="podcast" label="PODCAST">
          <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-3">
            {podcast.map((e) => (
              <AudioEmbed key={e.id} embed={e} />
            ))}
          </div>
        </Section>
      )}

      <Section id="plataformas" label="OTRAS PLATAFORMAS">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {OTHER_PLATFORMS.map((p) => (
            <a
              key={p.label}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="noid-card group flex items-center justify-between px-8 py-6"
            >
              <span className="font-display text-[11px] uppercase tracking-[0.35em] text-white/60 transition-colors duration-500 group-hover:text-white">
                {p.label}
              </span>
              <span
                aria-hidden="true"
                className="text-white/20 transition-all duration-500 group-hover:translate-x-2 group-hover:text-white"
              >
                →
              </span>
            </a>
          ))}
        </div>
      </Section>
    </div>
  )
}
