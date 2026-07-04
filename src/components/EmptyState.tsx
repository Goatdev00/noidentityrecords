import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  label: string
  title: string
  copy: string
  children?: ReactNode
}

/** Sober empty state: section label, one line, lots of air. */
export default function EmptyState({ label, title, copy, children }: Props) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-10 px-5 py-32 text-center md:py-40">
      <p className="noid-label">{label}</p>
      <h1 className="noid-title text-lg leading-relaxed text-white md:text-2xl">
        {title}
      </h1>
      <p className="max-w-md text-xs leading-loose tracking-[0.15em] text-white/60">
        {copy}
      </p>
      {children ?? (
        <Link to="/" className="noid-button mt-4">
          Volver al inicio
        </Link>
      )}
    </section>
  )
}
