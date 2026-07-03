import { Link } from 'react-router-dom'
import type { CourseSummary } from '../lib/academia'
import { formatCOP } from '../lib/format'

/**
 * Replica of the original `academy-container` card: full-width cover at
 * brightness(0.4), gradient overlay, pulse dot, floating title, price block.
 */
export default function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <Link
      to={`/academia/${course.slug}`}
      className="group relative flex min-h-[450px] w-full items-end overflow-hidden rounded-[4px] bg-black"
    >
      {course.cover_url ? (
        <img
          src={course.cover_url}
          alt=""
          className="absolute inset-0 z-[1] h-full w-full object-cover brightness-[0.4] transition-transform duration-[1500ms] ease-noid group-hover:scale-[1.03]"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[1] flex items-center justify-center border border-white/5"
        >
          <img src="/logo-noid-wordmark.png" alt="" className="w-40 opacity-10" />
        </div>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black via-black/70 to-transparent"
      />

      <div className="relative z-10 flex w-full flex-col justify-between gap-8 px-6 py-10 md:flex-row md:items-end md:px-10 md:py-12">
        <div className="flex items-start">
          <span
            aria-hidden="true"
            className="mr-6 mt-4 inline-block h-3 w-3 shrink-0 rounded-full border border-white transition-all duration-300 group-hover:bg-white group-hover:shadow-[0_0_20px_rgba(255,255,255,0.8)]"
          />
          <div className="animate-float text-left">
            <p className="mb-4 text-[12px] font-bold uppercase tracking-widest text-white/70">
              Workshop disponible
            </p>
            <h2 className="noid-title max-w-3xl text-2xl leading-tight text-white [text-shadow:0_4px_15px_rgba(0,0,0,1)] md:text-4xl">
              {course.title}
              {course.subtitle && (
                <span className="mt-1 block text-xl italic text-white/60 md:mt-0 md:inline md:text-2xl">
                  {' '}
                  {course.subtitle}
                </span>
              )}
            </h2>
          </div>
        </div>

        <div className="flex flex-col justify-end text-left md:text-right">
          <p className="text-3xl font-light tracking-widest md:text-5xl">
            {formatCOP(course.price_cop)}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-white/50">
            Acceso permanente
          </p>
        </div>
      </div>
    </Link>
  )
}
