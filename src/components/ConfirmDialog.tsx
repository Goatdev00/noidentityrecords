import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  title: string
  copy: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/** Sober confirmation: black card, hairline border, two buttons. */
export default function ConfirmDialog({
  open,
  title,
  copy,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
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
