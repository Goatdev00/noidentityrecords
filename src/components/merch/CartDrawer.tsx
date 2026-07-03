import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../../lib/cart'
import { formatCOP } from '../../lib/format'

export default function CartDrawer() {
  const { items, open, setOpen, totalCop, setQty, remove } = useCart()
  const asideRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // when closed, take the off-screen panel out of the tab order + a11y tree
  useEffect(() => {
    const el = asideRef.current
    if (el) el.inert = !open
  }, [open])

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    // focus into the panel so keyboard/AT users land inside the modal
    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'Tab' || !asideRef.current) return
      const f = asideRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      if (f.length === 0) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      opener?.focus() // restore focus to the trigger on close
    }
  }, [open, setOpen])

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-[80] ${open ? '' : 'pointer-events-none'}`}
    >
      {/* backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-500 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* panel */}
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label="Carrito"
        className={`absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-black transition-transform duration-500 ease-noid ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-white/5 px-6 py-5">
          <h2 className="noid-title text-xs text-white">CARRITO</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar carrito"
            className="p-1 text-white/40 transition-colors hover:text-white"
          >
            ✕
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
            <p className="text-xs leading-loose tracking-[0.15em] text-white/40">
              TU CARRITO ESTÁ VACÍO.
            </p>
            <Link
              to="/merch"
              onClick={() => setOpen(false)}
              className="text-[10px] uppercase tracking-[0.3em] text-white/60 transition-colors hover:text-white"
            >
              Ver la merch →
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-white/5 overflow-y-auto">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-4 px-6 py-5">
                  <div className="h-16 w-16 shrink-0 overflow-hidden border border-white/10 bg-white/[0.02]">
                    {item.image ? (
                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <img src="/logo-noid-wordmark.png" alt="" className="w-8 opacity-20" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link
                      to={`/merch/${item.slug}`}
                      onClick={() => setOpen(false)}
                      className="truncate text-[11px] uppercase tracking-[0.15em] text-white transition-opacity hover:opacity-70"
                    >
                      {item.name}
                    </Link>
                    <p className="text-[9px] uppercase tracking-[0.25em] text-white/40">
                      Talla {item.size}
                    </p>
                    <p className="text-[10px] tracking-[0.15em] text-white/60">
                      {formatCOP(item.priceCop)}
                    </p>
                    <div className="mt-1 flex items-center gap-3">
                      <div className="flex items-center border border-white/10">
                        <button
                          type="button"
                          onClick={() => setQty(item.variantId, item.qty - 1)}
                          aria-label="Quitar uno"
                          className="px-2 py-1 text-white/50 transition-colors hover:text-white"
                        >
                          −
                        </button>
                        <span className="min-w-6 text-center text-[10px] text-white">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(item.variantId, item.qty + 1)}
                          aria-label="Agregar uno"
                          className="px-2 py-1 text-white/50 transition-colors hover:text-white"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(item.variantId)}
                        className="text-[9px] uppercase tracking-[0.25em] text-white/30 transition-colors hover:text-accent"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="flex flex-col gap-4 border-t border-white/5 px-6 py-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">Total</span>
                <span className="text-sm tracking-[0.1em] text-white">{formatCOP(totalCop)}</span>
              </div>
              <Link
                to="/checkout"
                onClick={() => setOpen(false)}
                className="noid-button w-full text-center"
              >
                Finalizar compra
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
