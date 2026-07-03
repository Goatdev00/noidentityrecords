import { useEffect, useRef } from 'react'

/**
 * Brand signature — exact spec from the original page: a 200px radial light
 * (rgba(255,255,255,0.12) → 0 at 70%) that follows the cursor with 0.15
 * interpolation, mix-blend-mode: screen.
 * Desktop-only (fine pointer) and disabled under prefers-reduced-motion.
 */
export default function CursorLight() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const fine = window.matchMedia('(pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fine.matches || reduced.matches) return

    let raf = 0
    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let tx = x
    let ty = y
    let visible = false

    const onMove = (e: MouseEvent) => {
      tx = e.clientX
      ty = e.clientY
      if (!visible) {
        visible = true
        el.style.opacity = '1'
      }
    }
    const onLeave = () => {
      visible = false
      el.style.opacity = '0'
    }
    const onEnter = () => {
      visible = true
      el.style.opacity = '1'
    }
    // cross-origin iframes (bandcamp/soundcloud players) swallow mouse events,
    // so the light would freeze at the entry point; hide it while inside
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget instanceof HTMLIFrameElement) onLeave()
    }

    const tick = () => {
      x += (tx - x) * 0.15
      y += (ty - y) * 0.15
      el.style.transform = `translate3d(${x - 100}px, ${y - 100}px, 0)`
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseout', onOut)
    window.addEventListener('blur', onLeave)
    document.documentElement.addEventListener('mouseleave', onLeave)
    document.documentElement.addEventListener('mouseenter', onEnter)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseout', onOut)
      window.removeEventListener('blur', onLeave)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      document.documentElement.removeEventListener('mouseenter', onEnter)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[200px] w-[200px] rounded-full opacity-0 transition-opacity duration-300 mix-blend-screen will-change-transform"
      style={{
        background:
          'radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 70%)',
      }}
    />
  )
}
