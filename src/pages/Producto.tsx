import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import { fetchProductBySlug, type ProductDetail, type ProductVariant } from '../lib/merch'
import { formatCOP } from '../lib/format'
import { useCart } from '../lib/cart'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notfound' }
  | { status: 'ready'; product: ProductDetail }

export default function Producto() {
  const { slug } = useParams<{ slug: string }>()
  const { add, setOpen } = useCart()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [activeImage, setActiveImage] = useState(0)
  const [variant, setVariant] = useState<ProductVariant | null>(null)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setState({ status: 'loading' })
    // router reuses this component across /merch/:slug changes — reset per-product state
    setActiveImage(0)
    setAdded(false)
    setVariant(null)
    fetchProductBySlug(slug)
      .then((product) => {
        if (cancelled) return
        if (!product) {
          setState({ status: 'notfound' })
          return
        }
        setState({ status: 'ready', product })
        // preselect the first in-stock size
        setVariant(product.variants.find((v) => v.stock > 0) ?? null)
        document.title = `${product.name} — NO.ID RECORDS`
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status">
        <p className="noid-label animate-pulse">CARGANDO</p>
      </div>
    )
  }
  if (state.status === 'notfound') {
    return <EmptyState label="MERCH" title="PRODUCTO NO ENCONTRADO" copy="ESTE PRODUCTO NO ESTÁ DISPONIBLE O FUE RETIRADO." />
  }
  if (state.status === 'error') {
    return <EmptyState label="MERCH" title="ALGO SALIÓ MAL" copy="NO PUDIMOS CARGAR EL PRODUCTO. INTENTA DE NUEVO." />
  }

  const { product } = state
  const images = product.images.length > 0 ? product.images : [null]
  const soldOut = product.variants.length > 0 && product.variants.every((v) => v.stock <= 0)
  const canAdd = variant !== null && variant.stock > 0

  const onAdd = () => {
    if (!variant) return
    add({
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      size: variant.size,
      priceCop: product.price_cop,
      image: product.images[0] ?? null,
    })
    setAdded(true)
    setOpen(true)
    window.setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-5 pb-28 pt-12 md:grid-cols-2 md:px-8 md:pt-20">
      {/* gallery */}
      <div className="flex flex-col gap-4">
        <div className="aspect-square w-full overflow-hidden border border-white/5 bg-white/[0.02]">
          {images[activeImage] ? (
            <img src={images[activeImage] as string} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <img src="/logo-noid-wordmark.png" alt="" className="w-40 opacity-10" />
            </div>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-3">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImage(i)}
                aria-label={`Imagen ${i + 1}`}
                aria-current={i === activeImage}
                className={`h-16 w-16 shrink-0 overflow-hidden border transition-colors ${
                  i === activeImage ? 'border-white/40' : 'border-white/10 hover:border-white/25'
                }`}
              >
                {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* info */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="noid-title text-xl leading-relaxed text-white md:text-2xl">
            {product.name}
          </h1>
          <p className="text-lg tracking-[0.1em] text-white/70">{formatCOP(product.price_cop)}</p>
        </div>

        {product.description && (
          <p className="whitespace-pre-line text-sm leading-loose tracking-[0.05em] text-white/60">
            {product.description}
          </p>
        )}

        {/* sizes */}
        <div className="flex flex-col gap-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Talla</p>
          {product.variants.length === 0 ? (
            <p className="text-xs tracking-[0.15em] text-white/40">SIN TALLAS DISPONIBLES.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {product.variants.map((v) => {
                const disabled = v.stock <= 0
                const selected = variant?.id === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setVariant(v)}
                    aria-pressed={selected}
                    className={`min-w-12 border px-4 py-2 text-[11px] uppercase tracking-[0.2em] transition-colors ${
                      selected
                        ? 'border-white bg-white text-black'
                        : disabled
                          ? 'cursor-not-allowed border-white/5 text-white/20 line-through'
                          : 'border-white/20 text-white/70 hover:border-white/50'
                    }`}
                  >
                    {v.size}
                  </button>
                )
              })}
            </div>
          )}
          {variant && variant.stock > 0 && variant.stock <= 5 && (
            <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
              Solo quedan {variant.stock}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="noid-button self-start disabled:opacity-40"
        >
          {soldOut ? 'Agotado' : added ? '✓ Agregado' : 'Agregar al carrito'}
        </button>
      </div>
    </div>
  )
}
