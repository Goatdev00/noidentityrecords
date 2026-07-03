import { useCart } from '../../lib/cart'

function BagIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

export default function CartButton() {
  const { count, setOpen } = useCart()
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={`Abrir carrito${count > 0 ? ` (${count})` : ''}`}
      className="relative p-1 text-white/60 transition-colors duration-300 hover:text-white"
    >
      <BagIcon />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-black">
          {count > 9 ? '9+' : count}
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {count > 0 ? `${count} artículos en el carrito` : ''}
      </span>
    </button>
  )
}
