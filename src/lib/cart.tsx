import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/** A line in the cart — a snapshot so display survives catalog changes;
 *  stock is re-validated against the DB at checkout. */
export type CartItem = {
  variantId: string
  productId: string
  slug: string
  name: string
  size: string
  priceCop: number
  image: string | null
  qty: number
}

type CartState = {
  items: CartItem[]
  open: boolean
  count: number
  totalCop: number
  setOpen: (open: boolean) => void
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void
  setQty: (variantId: string, qty: number) => void
  remove: (variantId: string) => void
  clear: () => void
}

const CartContext = createContext<CartState | null>(null)

const STORAGE_KEY = 'noid-cart-v1'

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // defensive: keep only well-formed lines
    return parsed.filter(
      (i) =>
        i &&
        typeof i.variantId === 'string' &&
        typeof i.priceCop === 'number' &&
        typeof i.qty === 'number' &&
        i.qty > 0,
    )
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* storage full / disabled — cart just won't persist */
    }
  }, [items])

  // reflect cart edits from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const api = useMemo<CartState>(() => {
    const count = items.reduce((n, i) => n + i.qty, 0)
    const totalCop = items.reduce((n, i) => n + i.qty * i.priceCop, 0)
    return {
      items,
      open,
      count,
      totalCop,
      setOpen,
      add: (item, qty = 1) =>
        setItems((prev) => {
          const existing = prev.find((i) => i.variantId === item.variantId)
          if (existing) {
            return prev.map((i) =>
              i.variantId === item.variantId ? { ...i, qty: i.qty + qty } : i,
            )
          }
          return [...prev, { ...item, qty }]
        }),
      setQty: (variantId, qty) =>
        setItems((prev) =>
          qty <= 0
            ? prev.filter((i) => i.variantId !== variantId)
            : prev.map((i) => (i.variantId === variantId ? { ...i, qty } : i)),
        ),
      remove: (variantId) => setItems((prev) => prev.filter((i) => i.variantId !== variantId)),
      clear: () => setItems([]),
    }
  }, [items, open])

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
