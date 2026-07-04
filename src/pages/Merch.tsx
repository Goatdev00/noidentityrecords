import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import { fetchProducts, type ProductSummary } from '../lib/merch'
import { formatCOP } from '../lib/format'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; products: ProductSummary[] }

export default function Merch() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchProducts()
      .then((products) => {
        if (!cancelled) setState({ status: 'ready', products })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status">
        <p className="noid-label animate-pulse">CARGANDO</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <EmptyState
        label="MERCH"
        title="ALGO SALIÓ MAL"
        copy="NO PUDIMOS CARGAR LA TIENDA. REVISA TU CONEXIÓN E INTENTA DE NUEVO."
      />
    )
  }

  if (state.products.length === 0) {
    return (
      <EmptyState
        label="MERCH"
        title="LA TIENDA ABRE PRONTO"
        copy="ROPA DEL COLECTIVO EN EDICIONES LIMITADAS. VUELVE PRONTO."
      />
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 pb-28 pt-12 md:px-8 md:pt-20">
      <h1 className="noid-label pl-1 text-white/70">MERCH</h1>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
        {state.products.map((p) => (
          <Link key={p.id} to={`/merch/${p.slug}`} className="noid-card group flex flex-col">
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
                  <img src="/logo-noid-wordmark.png" alt="" className="w-24 opacity-10" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 px-4 py-4">
              <p className="truncate text-[11px] uppercase tracking-[0.15em] text-white/80 transition-colors duration-500 group-hover:text-white">
                {p.name}
              </p>
              <p className="text-[10px] tracking-[0.2em] text-white/40">{formatCOP(p.price_cop)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
