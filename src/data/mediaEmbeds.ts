/**
 * Media embeds for /musica.
 * Shaped exactly like the future `media_embeds` table (fase 2) so this
 * module can be swapped for a Supabase query without touching the UI.
 *
 * Curation follows the original page (reference/pagina-original.html):
 * its three Bandcamp albums and three SoundCloud players are kept verbatim
 * (same params: bgcol=333333, linkcol=9a64ff / color=%23171616), extended
 * with the label's newest releases and sessions (verified live, jul 2026).
 * Toggle `active` to show/hide without touching the UI.
 */
export type MediaEmbed = {
  id: string
  platform: 'bandcamp' | 'soundcloud'
  title: string
  meta: string
  embed_url: string
  /** iframe height in px (Bandcamp large player varies with tracklist length) */
  height: number
  position: number
  active: boolean
}

export type PlatformLink = {
  label: string
  url: string
}

const bc = (albumId: string) =>
  `https://bandcamp.com/EmbeddedPlayer/album=${albumId}/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/`

const scTrack = (kind: 'tracks' | 'playlists', id: string) =>
  `https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/${kind}/soundcloud%253A${kind}%253A${id}&color=%23171616&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`

const scPermalink = (permalink: string) =>
  `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    `https://soundcloud.com/noidcol/${permalink}`,
  )}&color=%23171616&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`

export const MEDIA_EMBEDS: MediaEmbed[] = [
  // ── BANDCAMP ── the original page's three albums (exact heights) + newest releases
  { id: 'bc-el-caminante-escarpado', platform: 'bandcamp', title: 'El Caminante Escarpado', meta: 'Alex Jockey · EL MAMU', embed_url: bc('2060091611'), height: 654, position: 1, active: true },
  { id: 'bc-singularidad-del-decidir', platform: 'bandcamp', title: 'Singularidad del Decidir', meta: 'Tav Shvi', embed_url: bc('4154602261'), height: 654, position: 2, active: true },
  { id: 'bc-align', platform: 'bandcamp', title: 'Align', meta: 'Lea Node', embed_url: bc('1712326544'), height: 654, position: 3, active: true },
  { id: 'bc-en-voz-alta', platform: 'bandcamp', title: 'En Voz Alta', meta: 'Sara Delirio', embed_url: bc('2333324377'), height: 654, position: 4, active: true },
  { id: 'bc-various-artists-ii', platform: 'bandcamp', title: 'Various Artists II', meta: 'V/A', embed_url: bc('1905391289'), height: 786, position: 5, active: true },
  { id: 'bc-des-sombres', platform: 'bandcamp', title: 'Des Sombres et des Lumières', meta: 'EL MAMU', embed_url: bc('1742511145'), height: 555, position: 6, active: true },
  { id: 'bc-noise-sample-pack', platform: 'bandcamp', title: 'Noise Sample Pack', meta: 'V/A', embed_url: bc('3754413479'), height: 654, position: 7, active: false },
  { id: 'bc-out-of-boundaries', platform: 'bandcamp', title: 'Out Of Boundaries', meta: 'Caotical Disordah', embed_url: bc('192374016'), height: 654, position: 8, active: false },
  { id: 'bc-revuelto-de-emociones', platform: 'bandcamp', title: 'Revuelto de Emociones', meta: '9 8 r p m', embed_url: bc('13855334'), height: 654, position: 9, active: false },
  { id: 'bc-fi-lo', platform: 'bandcamp', title: 'Fi-Lo', meta: 'Dunkelheit · EL MAMU · Sinistermind', embed_url: bc('3846456354'), height: 654, position: 10, active: false },
  { id: 'bc-baile-luminico', platform: 'bandcamp', title: 'Baile Lumínico', meta: 'ÆTERIS', embed_url: bc('2204012792'), height: 654, position: 11, active: false },
  { id: 'bc-soul-dance', platform: 'bandcamp', title: 'Soul Dance', meta: 'ZEWA', embed_url: bc('743011242'), height: 654, position: 12, active: false },
  { id: 'bc-remix-contest', platform: 'bandcamp', title: 'No.ID (Remix Contest)', meta: 'Tav Shvi', embed_url: bc('3498475324'), height: 654, position: 13, active: false },
  { id: 'bc-various-artists-i', platform: 'bandcamp', title: 'Various Artists I', meta: 'V/A', embed_url: bc('3638334684'), height: 654, position: 14, active: false },

  // ── SOUNDCLOUD ── the original page's three players + newest sessions/premieres
  { id: 'sc-specials-001', platform: 'soundcloud', title: 'Specials 001', meta: 'I-AM', embed_url: scTrack('tracks', '2238731435'), height: 280, position: 1, active: true },
  { id: 'sc-collection-va2', platform: 'soundcloud', title: 'Collection', meta: 'VA II', embed_url: scTrack('playlists', '2108674447'), height: 280, position: 2, active: true },
  { id: 'sc-specials-002', platform: 'soundcloud', title: 'Specials 002', meta: 'L0L4 Hartz', embed_url: scTrack('tracks', '2237925419'), height: 280, position: 3, active: true },
  { id: 'sc-sessions-tepe', platform: 'soundcloud', title: 'Podcast Sessions', meta: 'Tepé', embed_url: scPermalink('no-id-podcast-sessions-tepe'), height: 280, position: 4, active: true },
  { id: 'sc-premiere-corsac', platform: 'soundcloud', title: 'Premiere', meta: 'Corsac — Ignis', embed_url: scPermalink('corsac-ignis-oneiromancer'), height: 280, position: 5, active: true },
  { id: 'sc-sessions-diluet', platform: 'soundcloud', title: 'Podcast Sessions', meta: 'Diluet', embed_url: scPermalink('no-id-podcast-sessions-diluet'), height: 280, position: 6, active: true },
  { id: 'sc-sessions-alex-cordova', platform: 'soundcloud', title: 'Podcast Sessions', meta: 'Alex Cordova', embed_url: scPermalink('no-id-podcast-sessions-alex'), height: 280, position: 7, active: false },
  { id: 'sc-sessions-dave-l', platform: 'soundcloud', title: 'Podcast Sessions', meta: 'Dave L', embed_url: scPermalink('no-id-podcast-sessions-dave-l'), height: 280, position: 8, active: false },
  { id: 'sc-premiere-98rpm', platform: 'soundcloud', title: 'Premiere', meta: '9 8 r p m', embed_url: scPermalink('9-8-r-p-m-keep-it-simple-art'), height: 280, position: 9, active: false },
]

export const OTHER_PLATFORMS: PlatformLink[] = [
  { label: 'Resident Advisor', url: 'https://fr.ra.co/promoters/142608' },
  { label: 'Instagram', url: 'https://www.instagram.com/noid.col/' },
  { label: 'Bandcamp', url: 'https://noidrecords.bandcamp.com/' },
  { label: 'SoundCloud', url: 'https://soundcloud.com/noidcol' },
]
