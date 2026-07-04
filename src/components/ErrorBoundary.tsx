import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/**
 * Catches render-time errors anywhere below it and shows a sober branded
 * fallback instead of a blank page. "Recargar" does a hard reload so the app
 * re-mounts from a clean state.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // surfaced in the console for debugging; no external logging by design
    console.error('Unhandled error:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
        <img src="/logo-noid-wordmark.png" alt="No.ID Records" className="w-40 opacity-60" />
        <h1 className="noid-title text-base leading-relaxed text-white">ALGO SALIÓ MAL</h1>
        <p className="max-w-sm text-xs leading-loose tracking-[0.15em] text-white/40">
          OCURRIÓ UN ERROR INESPERADO. RECARGA LA PÁGINA PARA CONTINUAR.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign('/')}
          className="noid-button"
        >
          Recargar
        </button>
      </div>
    )
  }
}
