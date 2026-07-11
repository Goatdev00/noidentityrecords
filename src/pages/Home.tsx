import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BRAND } from '../lib/constants'
import { fetchPublishedCourses, type CourseSummary } from '../lib/academia'
import { fetchProducts, type ProductSummary } from '../lib/merch'
import { supabase } from '../lib/supabase'
import {
  MEDIA_EMBEDS,
  classifySection,
  byPosition,
  type MediaEmbed,
} from '../data/mediaEmbeds'
import CourseCard from '../components/CourseCard'
import AudioEmbed from '../components/AudioEmbed'
import EventBanner from '../components/EventBanner'
import { formatCOP } from '../lib/format'

/** Section wrapper with the original left label + a "ver todo" link. */
function Section({
  label,
  to,
  children,
}: {
  label: string
  to: string
  children: ReactNode
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="noid-label pl-1">{label}</h2>
        <Link
          to={to}
          className="shrink-0 text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors duration-300 hover:text-white"
        >
          Ver todo →
        </Link>
      </div>
      {children}
    </section>
  )
}

function ComingSoon({ text }: { text: string }) {
  return (
    <div className="noid-card flex items-center justify-center p-12 text-center">
      <p className="text-xs leading-loose tracking-[0.15em] text-white/40">{text}</p>
    </div>
  )
}

export default function Home() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null)
  const [products, setProducts] = useState<ProductSummary[] | null>(null)
  const [embeds, setEmbeds] = useState<MediaEmbed[]>(MEDIA_EMBEDS)

  useEffect(() => {
    let cancelled = false
    fetchPublishedCourses()
      .then((c) => !cancelled && setCourses(c))
      .catch(() => !cancelled && setCourses([]))
    fetchProducts()
      .then((p) => !cancelled && setProducts(p))
      .catch(() => !cancelled && setProducts([]))
    supabase
      .from('media_embeds')
      .select('id, platform, title, meta, embed_url, height, position, active, section, created_at')
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

  const featuredCourse = courses?.[0] ?? null
  const merchPreview = (products ?? []).slice(0, 6)
  const bandcamp = embeds
    .filter((e) => e.active && e.section === 'bandcamp')
    .sort((a, b) => a.position - b.position)
    .slice(0, 3)
  // podcasts: manual order (new uploads land on top); 3 on the landing
  const podcast = embeds
    .filter((e) => e.active && e.section === 'podcast')
    .sort(byPosition)
    .slice(0, 3)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-28 px-5 pb-28 md:px-8">
      {/* hero */}
      <section className="flex min-h-[52vh] flex-col items-center justify-center gap-8 py-16 text-center">
        <img
          src="/logo-noid-wordmark.png"
          alt="No.Identity Records"
          className="w-52 animate-float md:w-72"
        />
        <div className="flex flex-col gap-4">
          <h1 className="noid-title text-2xl leading-relaxed text-white md:text-4xl">
            NO.IDENTITY RECORDS
          </h1>
          <p className="noid-label text-center">TECHNO · {BRAND.city}</p>
        </div>
      </section>

      {/* próximo evento */}
      <EventBanner />

      {/* ACADEMIA */}
      <Section label="ACADEMIA" to="/academia">
        {courses === null ? (
          <div className="noid-card flex min-h-[280px] items-center justify-center" role="status">
            <p className="noid-label animate-pulse">CARGANDO</p>
          </div>
        ) : featuredCourse ? (
          <CourseCard course={featuredCourse} />
        ) : (
          <ComingSoon text="CURSOS DE PRODUCCIÓN DE TECHNO, DIRECTO DEL COLECTIVO. MUY PRONTO." />
        )}
      </Section>

      {/* MERCH */}
      <Section label="MERCH" to="/merch">
        {products === null ? (
          <div className="noid-card flex min-h-[200px] items-center justify-center" role="status">
            <p className="noid-label animate-pulse">CARGANDO</p>
          </div>
        ) : merchPreview.length > 0 ? (
          <div className="-mx-5 flex snap-x gap-5 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {merchPreview.map((p) => (
              <Link
                key={p.id}
                to={`/merch/${p.slug}`}
                className="noid-card group flex w-40 shrink-0 snap-start flex-col md:w-52"
              >
                <div className="aspect-square w-full overflow-hidden bg-white/[0.02]">
                  {p.images[0] ? (
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-noid group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <img src="/logo-noid-wordmark.png" alt="" className="w-20 opacity-10" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 px-4 py-3">
                  <p className="truncate text-[11px] uppercase tracking-[0.15em] text-white/80 transition-colors duration-500 group-hover:text-white">
                    {p.name}
                  </p>
                  <p className="text-[10px] tracking-[0.2em] text-white/40">{formatCOP(p.price_cop)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <ComingSoon text="ROPA DEL COLECTIVO EN EDICIONES LIMITADAS. LA TIENDA ABRE PRONTO." />
        )}
      </Section>

      {/* RECORD LABEL */}
      {bandcamp.length > 0 && (
        <Section label="RECORD LABEL" to="/label">
          <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-3">
            {bandcamp.map((e) => (
              <AudioEmbed key={e.id} embed={e} />
            ))}
          </div>
        </Section>
      )}

      {podcast.length > 0 && (
        <Section label="PODCAST" to="/label#podcast">
          <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-3">
            {podcast.map((e) => (
              <AudioEmbed key={e.id} embed={e} />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
