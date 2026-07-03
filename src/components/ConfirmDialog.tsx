import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  title: string
  copy: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/** Sober confirmation: black card, hairline border, two buttons.
 *  Traps focus while open and restores it to the opener on close. */
export default function ConfirmDialog({
  open,
  title,
  copy,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    confirmRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="flex w-full max-w-sm flex-col gap-6 border border-white/10 bg-black p-8 text-center"
      >
        <h2 className="noid-title text-sm text-white">{title}</h2>
        <p className="text-xs leading-loose tracking-[0.1em] text-white/50">{copy}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="noid-button"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-4 font-display text-[11px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
