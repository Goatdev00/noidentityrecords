import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { fetchVariantStock } from '../lib/merch'
import { formatCOP } from '../lib/format'

const inputClass =
  'w-full min-w-0 border border-white/10 bg-transparent px-4 py-3 text-sm tracking-[0.1em] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none transition-colors duration-300'
const labelClass = 'text-[10px] uppercase tracking-[0.3em] text-white/40'

type Shipping = {
  name: string
  document: string
  address: string
  city: string
  phone: string
}

export default function Checkout() {
  const { session } = useAuth()
  const { items, totalCop, setQty } = useCart()
  const [shipping, setShipping] = useState<Shipping>({
    name: '',
    document: '',
    address: '',
    city: '',
    phone: '',
  })
  const [stockError, setStockError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const variantIds = useMemo(() => items.map((i) => i.variantId), [items])

  // keep the cart honest against current stock while on this page
  useEffect(() => {
    if (variantIds.length === 0) return
    let cancelled = false
    fetchVariantStock(variantIds)
      .then((stock) => {
        if (cancelled) return
        for (const item of items) {
          const available = stock[item.variantId] ?? 0
          if (available < item.qty) {
            setStockError(
              available <= 0
                ? `"${item.name}" (talla ${item.size}) se agotó y se quitó del carrito.`
                : `Solo quedan ${available} de "${item.name}" (talla ${item.size}).`,
            )
            setQty(item.variantId, available)
          }
        }
      })
      .catch(() => {
        /* leave the cart as-is; the server re-validates at payment time */
      })
    // re-run only when the set of variants changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantIds.join(',')])

  const set = (k: keyof Shipping) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setShipping((s) => ({ ...s, [k]: e.target.value }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    // Payment is wired to Bold in fase 6. create-payment will compute the
    // amount server-side from these variant ids + this shipping data, then
    // open BoldCheckout. For now we stop cleanly at the payment step.
    window.setTimeout(() => setSubmitting(false), 400)
  }

  if (!session) {
    return (
      <section className="mx-auto flex max-w-md flex-col items-center gap-8 px-6 py-24 text-center md:py-32">
        <p className="noid-label">CHECKOUT</p>
        <h1 className="noid-title text-base leading-relaxed text-white">
          INICIA SESIÓN PARA COMPRAR
        </h1>
        <p className="text-xs leading-loose tracking-[0.15em] text-white/40">
          NECESITAS UNA CUENTA PARA COMPLETAR TU PEDIDO. TU CARRITO SE MANTIENE.
        </p>
        <Link to="/login" state={{ from: '/checkout' }} className="noid-button">
          Iniciar sesión
        </Link>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto flex max-w-md flex-col items-center gap-8 px-6 py-24 text-center md:py-32">
        <p className="noid-label">CHECKOUT</p>
        <h1 className="noid-title text-base leading-relaxed text-white">TU CARRITO ESTÁ VACÍO</h1>
        <Link to="/merch" className="noid-button">
          Ver la merch
        </Link>
      </section>
    )
  }

  const complete =
    shipping.name.trim() &&
    shipping.document.trim() &&
    shipping.address.trim() &&
    shipping.city.trim() &&
    shipping.phone.trim()

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-6 pb-28 pt-12 md:grid-cols-[1fr_360px] md:pt-20">
      {/* shipping form */}
      <form onSubmit={onSubmit} className="flex flex-col gap-8">
        <h1 className="noid-label">DATOS DE ENVÍO</h1>
        <div className="flex flex-col gap-2">
          <label htmlFor="s-name" className={labelClass}>Nombre completo</label>
          <input id="s-name" required autoComplete="name" value={shipping.name} onChange={set('name')} className={inputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="s-doc" className={labelClass}>Documento</label>
          <input id="s-doc" required inputMode="numeric" value={shipping.document} onChange={set('document')} className={inputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="s-address" className={labelClass}>Dirección</label>
          <input id="s-address" required autoComplete="street-address" value={shipping.address} onChange={set('address')} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="s-city" className={labelClass}>Ciudad</label>
            <input id="s-city" required autoComplete="address-level2" value={shipping.city} onChange={set('city')} className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="s-phone" className={labelClass}>Teléfono</label>
            <input id="s-phone" required inputMode="tel" autoComplete="tel" value={shipping.phone} onChange={set('phone')} className={inputClass} />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/5 pt-6">
          <button type="submit" disabled={!complete || submitting} className="noid-button self-start disabled:opacity-40">
            Ir a pagar
          </button>
          <p className="text-[10px] uppercase leading-relaxed tracking-[0.25em] text-white/40">
            El pago con Bold se habilita muy pronto. Tus datos y tu carrito ya
            están listos para el checkout.
          </p>
        </div>
      </form>

      {/* order summary */}
      <aside className="flex flex-col gap-6 md:sticky md:top-28 md:h-fit">
        <h2 className="noid-label">TU PEDIDO</h2>
        {stockError && (
          <p role="alert" className="text-[11px] leading-relaxed tracking-[0.1em] text-accent">
            {stockError}
          </p>
        )}
        <ul className="flex flex-col divide-y divide-white/5 border border-white/5">
          {items.map((item) => (
            <li key={item.variantId} className="flex items-center justify-between gap-4 px-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-[11px] uppercase tracking-[0.15em] text-white">{item.name}</p>
                <p className="text-[9px] uppercase tracking-[0.25em] text-white/40">
                  Talla {item.size} · x{item.qty}
                </p>
              </div>
              <span className="shrink-0 text-[10px] tracking-[0.1em] text-white/60">
                {formatCOP(item.priceCop * item.qty)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">Total</span>
          <span className="text-sm tracking-[0.1em] text-white">{formatCOP(totalCop)}</span>
        </div>
        <Link
          to="/merch"
          className="text-[10px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
        >
          ← Seguir comprando
        </Link>
      </aside>
    </div>
  )
}
