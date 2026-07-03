export type ParsedVideo =
  | { provider: 'youtube'; id: string; embedUrl: string }
  | { provider: 'vimeo'; id: string; embedUrl: string }
  | { provider: 'unknown'; id: null; embedUrl: null }

/**
 * Turn a lesson's external video URL into a privacy-friendly embed URL.
 * YouTube → youtube-nocookie.com with rel=0 & modestbranding=1 (quality can
 * NOT be forced from the embed — YouTube picks it from the connection).
 * Vimeo → player.vimeo.com with quality=1080p requested (Vimeo honors it).
 */
export function parseVideo(rawUrl: string | null | undefined): ParsedVideo {
  const unknown = { provider: 'unknown', id: null, embedUrl: null } as const
  if (!rawUrl) return unknown
  const url = rawUrl.trim()
  if (!url) return unknown

  // ── YouTube ──
  // watch?v=ID · youtu.be/ID · /embed/ID · /shorts/ID · /live/ID
  const yt =
    url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/) ||
    (/^[A-Za-z0-9_-]{11}$/.test(url) ? [url, url] : null)
  if (yt) {
    const id = yt[1]
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      // enablejsapi lets us listen for the ended event to auto-complete
      enablejsapi: '1',
    })
    return {
      provider: 'youtube',
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`,
    }
  }

  // ── Vimeo ──
  // vimeo.com/ID · vimeo.com/channels/x/ID · player.vimeo.com/video/ID
  // optional unlisted hash: vimeo.com/ID/HASH
  const vm = url.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)(?:\/([A-Za-z0-9]+))?/)
  if (vm) {
    const id = vm[1]
    const hash = vm[2]
    const params = new URLSearchParams({ quality: '1080p', dnt: '1' })
    if (hash) params.set('h', hash)
    return {
      provider: 'vimeo',
      id,
      embedUrl: `https://player.vimeo.com/video/${id}?${params.toString()}`,
    }
  }

  return unknown
}
