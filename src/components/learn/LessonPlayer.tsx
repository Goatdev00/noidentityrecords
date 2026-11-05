import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
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

/** What the custom controls need from either provider. */
type Engine = {
  play: () => void
  pause: () => void
  seek: (seconds: number) => void
  setMuted: (muted: boolean) => void
  time: () => Promise<number>
  duration: () => Promise<number>
  destroy: () => void
}

type PlayState = 'idle' | 'playing' | 'paused' | 'ended'

/** If the browser refuses to start playback from our button (Safari/iOS
 *  can block a play() that doesn't come from a tap inside the iframe), we
 *  let ONE tap reach the provider's own central play button instead. */
const START_TIMEOUT_MS = 1800
const HIDE_CONTROLS_MS = 2500
/** YouTube paints its title bar, share icon and logo for ~4 s after every
 *  start/resume/seek (and keeps them while paused). Unclickable already —
 *  this keeps them out of sight too. */
const PROVIDER_CHROME_MS = 4500

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

type Props = {
  video: ParsedVideo
  /** stable per-lesson so the player is torn down and rebuilt on lesson change */
  lessonId: string
  onEnded: () => void
  title?: string
}

/**
 * Lesson video in a locked shell: the provider's own UI is hidden
 * (YouTube controls=0 / Vimeo controls=false) and the iframe never receives
 * pointer events, so nobody can click through to YouTube/Vimeo — no title,
 * channel, "watch on", share, logo, right-click "copy URL" or end-screen
 * suggestions. Playback is driven by our controls through the provider APIs.
 * Auto-fires onEnded when the video finishes.
 */
export default function LessonPlayer({ video, lessonId, onEnded, title }: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
  const startTimer = useRef<number | undefined>(undefined)
  const hideTimer = useRef<number | undefined>(undefined)
  const maskTimer = useRef<number | undefined>(undefined)
  // touch: the first tap on a playing video only reveals the controls
  const revealOnly = useRef(false)

  const [ready, setReady] = useState(false)
  const [state, setState] = useState<PlayState>('idle')
  const [started, setStarted] = useState(false)
  const [tapThrough, setTapThrough] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [posterOk, setPosterOk] = useState(true)
  const [masked, setMasked] = useState(false)

  const maskProviderChrome = useCallback(() => {
    setMasked(true)
    window.clearTimeout(maskTimer.current)
    maskTimer.current = window.setTimeout(() => setMasked(false), PROVIDER_CHROME_MS)
  }, [])

  // ── build the provider player (rebuilt per lesson) ──
  useEffect(() => {
    if (video.provider === 'unknown') return
    const el = mountRef.current
    if (!el) return

    let disposed = false
    let raw: any = null
    setReady(false)
    setState('idle')
    setStarted(false)
    setTapThrough(false)
    setTime(0)
    setDuration(0)
    setPosterOk(true)

    const accepted = () => window.clearTimeout(startTimer.current)
    const onPlaying = () => {
      accepted()
      maskProviderChrome()
      setState('playing')
      setStarted(true)
      setTapThrough(false)
    }
    const onPaused = () => setState('paused')
    const onFinished = () => {
      setState('ended')
      onEndedRef.current()
    }
    const lockIframe = () => {
      const f = el.querySelector('iframe')
      f?.setAttribute('tabindex', '-1')
      f?.setAttribute('title', title ?? 'Video de la lección')
    }

    if (video.provider === 'youtube') {
      const target = document.createElement('div')
      el.appendChild(target)
      void ytApiReady().then(() => {
        if (disposed) return
        raw = new window.YT.Player(target, {
          videoId: video.id,
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          playerVars: {
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            cc_load_policy: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (disposed) return
              lockIframe()
              const p = raw
              engineRef.current = {
                play: () => p.playVideo(),
                pause: () => p.pauseVideo(),
                seek: (s) => p.seekTo(s, true),
                setMuted: (m) => (m ? p.mute() : p.unMute()),
                time: async () => p.getCurrentTime?.() ?? 0,
                duration: async () => p.getDuration?.() ?? 0,
                destroy: () => p.destroy(),
              }
              setDuration(p.getDuration?.() ?? 0)
              setReady(true)
            },
            onStateChange: (e: any) => {
              // -1 unstarted · 0 ended · 1 playing · 2 paused · 3 buffering · 5 cued
              if (e.data === 1) onPlaying()
              else if (e.data === 3) accepted()
              else if (e.data === 2) onPaused()
              else if (e.data === 0) onFinished()
            },
          },
        })
        // the iframe exists as soon as the player is constructed
        lockIframe()
      })
    } else {
      const hash = new URL(video.embedUrl).searchParams.get('h')
      void loadScript('https://player.vimeo.com/api/player.js').then(() => {
        if (disposed) return
        raw = new window.Vimeo.Player(el, {
          url: `https://vimeo.com/${video.id}${hash ? `/${hash}` : ''}`,
          controls: false,
          title: false,
          byline: false,
          portrait: false,
          keyboard: false,
          pip: false,
          dnt: true,
          playsinline: true,
          quality: '1080p',
        })
        const p = raw
        lockIframe()
        p.on('playing', onPlaying)
        p.on('bufferstart', accepted)
        p.on('pause', onPaused)
        p.on('ended', onFinished)
        void p.ready().then(async () => {
          if (disposed) return
          lockIframe()
          engineRef.current = {
            play: () => void p.play().catch(() => {}),
            pause: () => void p.pause().catch(() => {}),
            seek: (s) => void p.setCurrentTime(s).catch(() => {}),
            setMuted: (m) => void p.setVolume(m ? 0 : 1).catch(() => {}),
            time: () => p.getCurrentTime(),
            duration: () => p.getDuration(),
            destroy: () => void p.destroy().catch(() => {}),
          }
          setDuration(await p.getDuration().catch(() => 0))
          setReady(true)
        })
      })
    }

    return () => {
      disposed = true
      window.clearTimeout(startTimer.current)
      try {
        raw?.destroy?.()
      } catch {
        /* ignore teardown errors */
      }
      engineRef.current = null
      el.innerHTML = ''
    }
    // rebuild whenever the lesson (hence the video) changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, video.provider, video.id])

  // ── progress while playing ──
  useEffect(() => {
    if (state !== 'playing') return
    const tick = () => {
      const e = engineRef.current
      if (!e) return
      void e.time().then(setTime)
      void e.duration().then((d) => d > 0 && setDuration(d))
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [state])

  // ── fullscreen on OUR shell (the shield stays on top), never the iframe ──
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === shellRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(
    () => () => {
      window.clearTimeout(startTimer.current)
      window.clearTimeout(hideTimer.current)
      window.clearTimeout(maskTimer.current)
    },
    [],
  )

  const toggle = useCallback(() => {
    const e = engineRef.current
    if (!e) return
    if (state === 'playing') {
      e.pause()
      return
    }
    if (state === 'ended') e.seek(0)
    e.play()
    if (!started) {
      window.clearTimeout(startTimer.current)
      startTimer.current = window.setTimeout(() => setTapThrough(true), START_TIMEOUT_MS)
    }
  }, [state, started])

  const seekTo = (s: number) => {
    const clamped = Math.max(0, Math.min(duration || s, s))
    setTime(clamped)
    engineRef.current?.seek(clamped)
    maskProviderChrome()
  }

  const toggleMute = () => {
    const next = !muted
    engineRef.current?.setMuted(next)
    setMuted(next)
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void shellRef.current?.requestFullscreen?.()
  }

  const wake = () => {
    setShowControls(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setShowControls(false), HIDE_CONTROLS_MS)
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!started || tapThrough) return
    const k = e.key.toLowerCase()
    if (k === ' ' || k === 'k') {
      e.preventDefault()
      toggle()
    } else if (k === 'arrowright') seekTo(time + 5)
    else if (k === 'arrowleft') seekTo(time - 5)
    else if (k === 'm') toggleMute()
    else if (k === 'f') toggleFullscreen()
    else return
    wake()
  }

  if (video.provider === 'unknown') {
    return (
      <div className="flex aspect-video w-full items-center justify-center border border-white/10 bg-black text-center">
        <p className="px-6 text-xs leading-loose tracking-[0.15em] text-white/40">
          EL VIDEO DE ESTA LECCIÓN AÚN NO ESTÁ DISPONIBLE.
        </p>
      </div>
    )
  }

  const playing = state === 'playing'
  const controlsVisible = !playing || showControls
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled
  const poster =
    video.provider === 'youtube' && posterOk ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : null

  return (
    <div
      ref={shellRef}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMove={wake}
      onPointerDown={(e) => {
        revealOnly.current = e.pointerType !== 'mouse' && playing && !showControls
        wake()
      }}
      onFocus={wake}
      onKeyDown={onKey}
      className={`relative w-full select-none overflow-hidden bg-black ${fullscreen ? 'h-full' : 'aspect-video'} ${
        playing && !controlsVisible ? 'cursor-none' : ''
      }`}
    >
      {/* provider iframe — never clickable outside the one-tap fallback */}
      <div
        ref={mountRef}
        aria-hidden="true"
        className={`h-full w-full [&_iframe]:h-full [&_iframe]:w-full ${
          tapThrough ? '' : '[&_iframe]:pointer-events-none'
        }`}
      />

      {tapThrough ? (
        <>
          {/* the provider's title/channel bar and logo/"watch on" stay blocked */}
          <div className="absolute inset-x-0 top-0 z-10 h-[24%]" onClick={(e) => e.preventDefault()} />
          <div className="absolute inset-x-0 bottom-0 z-10 h-[24%]" onClick={(e) => e.preventDefault()} />
          <div className="absolute inset-y-[24%] left-0 z-10 w-[30%]" onClick={(e) => e.preventDefault()} />
          <div className="absolute inset-y-[24%] right-0 z-10 w-[30%]" onClick={(e) => e.preventDefault()} />
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (revealOnly.current) {
              revealOnly.current = false
              return
            }
            toggle()
          }}
          disabled={!ready}
          aria-label={playing ? 'Pausar' : state === 'ended' ? 'Ver de nuevo' : 'Reproducir'}
          className="absolute inset-0 z-10 flex h-full w-full cursor-pointer items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
        >
          {/* before the first play: our own poster hides the provider's start screen */}
          {!started && (
            <span className="absolute inset-0 bg-black">
              {poster && (
                <img
                  src={poster}
                  alt=""
                  draggable={false}
                  onError={() => setPosterOk(false)}
                  className="h-full w-full object-cover opacity-70"
                />
              )}
            </span>
          )}
          {/* hide the provider's title bar, share icon and logo — leaves the
              centre (and captions) visible */}
          {started && state !== 'ended' && (masked || state === 'paused') && (
            <span aria-hidden="true" className="pointer-events-none absolute inset-0">
              <span className="absolute inset-x-0 top-0 h-[17%] bg-gradient-to-b from-black from-60% to-transparent" />
              <span className="absolute bottom-0 left-0 h-[16%] w-[13%] bg-gradient-to-tr from-black from-55% to-transparent" />
              <span className="absolute bottom-0 right-0 h-[16%] w-[19%] bg-gradient-to-tl from-black from-55% to-transparent" />
            </span>
          )}
          {/* paused: dim the frame (covers "more videos"); ended: black (covers suggestions) */}
          {started && state === 'paused' && <span className="absolute inset-0 bg-black/70" />}
          {state === 'ended' && <span className="absolute inset-0 bg-black" />}

          {!playing && (
            <span className="relative flex flex-col items-center gap-4">
              <span
                className={`flex h-16 w-16 items-center justify-center rounded-full border border-white/40 bg-black/40 backdrop-blur-sm transition-opacity ${
                  ready ? 'opacity-100' : 'opacity-40'
                }`}
              >
                {state === 'ended' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" aria-hidden="true">
                    <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true" className="ml-1">
                    <path d="M7 4.5v15l12-7.5z" />
                  </svg>
                )}
              </span>
              {state === 'ended' && (
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/70">Ver de nuevo</span>
              )}
            </span>
          )}
        </button>
      )}

      {/* our controls */}
      {started && !tapThrough && (
        <div
          className={`absolute inset-x-0 bottom-0 z-20 flex items-center gap-4 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300 ${
            controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
            className="shrink-0 text-white/80 transition-colors hover:text-white"
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 4.5v15l12-7.5z" />
              </svg>
            )}
          </button>
          <span className="shrink-0 font-display text-[9px] tabular-nums tracking-[0.15em] text-white/60">
            {fmt(time)} / {fmt(duration)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label="Posición del video"
            className="h-1 min-w-0 flex-1 cursor-pointer accent-accent"
          />
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            aria-pressed={muted}
            className="shrink-0 text-white/80 transition-colors hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" />
              {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />}
            </svg>
          </button>
          {canFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              className="shrink-0 text-white/80 transition-colors hover:text-white"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                {fullscreen ? (
                  <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                ) : (
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                )}
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
