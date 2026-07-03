import { useEffect, useRef } from 'react'
import type { ParsedVideo } from '../../lib/video'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
    Vimeo?: any
  }
}

/** Load an external script once, resolving when ready. */
const scriptCache = new Map<string, Promise<void>>()
function loadScript(src: string): Promise<void> {
  const cached = scriptCache.get(src)
  if (cached) return cached
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`failed to load ${src}`))
    document.head.appendChild(s)
  })
  scriptCache.set(src, p)
  return p
}

function ytApiReady(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    void loadScript('https://www.youtube.com/iframe_api')
  })
}

type Props = {
  video: ParsedVideo
  /** stable per-lesson so the player is torn down and rebuilt on lesson change */
  lessonId: string
  onEnded: () => void
}

/**
 * Renders the lesson video and auto-fires onEnded when it finishes.
 * YouTube via the IFrame API (youtube-nocookie host, rel=0, modestbranding),
 * Vimeo via the Player SDK (1080p requested). Quality can't be forced on
 * YouTube — the player picks it from the connection.
 */
export default function LessonPlayer({ video, lessonId, onEnded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  useEffect(() => {
    if (video.provider === 'unknown') return
    const el = containerRef.current
    if (!el) return

    let disposed = false
    let player: any = null

    if (video.provider === 'youtube') {
      const mount = document.createElement('div')
      el.appendChild(mount)
      void ytApiReady().then(() => {
        if (disposed) return
        player = new window.YT.Player(mount, {
          videoId: video.id,
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onStateChange: (e: any) => {
              // YT.PlayerState.ENDED === 0
              if (e.data === 0) onEndedRef.current()
            },
          },
        })
      })
    } else {
      void loadScript('https://player.vimeo.com/api/player.js').then(() => {
        if (disposed) return
        player = new window.Vimeo.Player(el, {
          id: video.id,
          responsive: true,
          dnt: true,
          quality: '1080p',
        })
        player.on('ended', () => onEndedRef.current())
      })
    }

    return () => {
      disposed = true
      try {
        player?.destroy?.()
      } catch {
        /* ignore teardown errors */
      }
      el.innerHTML = ''
    }
    // rebuild whenever the lesson (hence the video) changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, video.provider, video.id])

  if (video.provider === 'unknown') {
    return (
      <div className="flex aspect-video w-full items-center justify-center border border-white/10 bg-black text-center">
        <p className="px-6 text-xs leading-loose tracking-[0.15em] text-white/40">
          EL VIDEO DE ESTA LECCIÓN AÚN NO ESTÁ DISPONIBLE.
        </p>
      </div>
    )
  }

  return (
    <div className="aspect-video w-full overflow-hidden bg-black">
      <div ref={containerRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />
    </div>
  )
}
