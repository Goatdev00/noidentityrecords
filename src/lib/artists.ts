import { supabase } from './supabase'

/** Artist catalog data layer (/artistas). RLS + the artists_guard trigger are
 *  the real gate: owners can't change status/ownership/slug, links must be
 *  http(s), tracks must be SoundCloud. The checks here only give early,
 *  friendly errors. */

export type ArtistLink = { label: string; url: string }
export type ArtistTrack = { url: string; title?: string }
export type ArtistStatus = 'pending' | 'approved' | 'hidden'

export type Artist = {
  id: string
  slug: string
  name: string
  subtitle: string | null
  city: string | null
  bio: string | null
  image_url: string | null
  links: ArtistLink[]
  tracks: ArtistTrack[]
  documents: ArtistLink[]
  status: ArtistStatus
  user_id: string | null
}

export type ArtistCard = Pick<Artist, 'id' | 'slug' | 'name' | 'subtitle' | 'image_url'>

/** What an owner (or admin) can edit. */
export type ArtistInput = {
  name: string
  subtitle: string | null
  city: string | null
  bio: string | null
  image_url: string | null
  links: ArtistLink[]
  tracks: ArtistTrack[]
  documents: ArtistLink[]
}

export const EMPTY_ARTIST: ArtistInput = {
  name: '',
  subtitle: null,
  city: null,
  bio: null,
  image_url: null,
  links: [],
  tracks: [],
  documents: [],
}

/** Artist row → editable input (drops server-only fields). */
export function toArtistInput(a: ArtistInput): ArtistInput {
  return {
    name: a.name,
    subtitle: a.subtitle,
    city: a.city,
    bio: a.bio,
    image_url: a.image_url,
    links: a.links ?? [],
    tracks: a.tracks ?? [],
    documents: a.documents ?? [],
  }
}

export const LIMITS = {
  name: 80,
  subtitle: 80,
  city: 60,
  bio: 4000,
  links: 12,
  tracks: 8,
  documents: 6,
  label: 40,
  photoBytes: 5 * 1024 * 1024,
  docBytes: 10 * 1024 * 1024,
} as const

const ARTIST_COLS =
  'id, slug, name, subtitle, city, bio, image_url, links, tracks, documents, status, user_id'
const CARD_COLS = 'id, slug, name, subtitle, image_url'

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true })

// ── public ───────────────────────────────────────────────────────────────────

/** Approved artists, alphabetical (accent/case-insensitive, like a catalog). */
export async function fetchCatalog(): Promise<ArtistCard[]> {
  const { data, error } = await supabase
    .from('artists')
    .select(CARD_COLS)
    .eq('status', 'approved')
  if (error) throw error
  return ((data ?? []) as ArtistCard[]).sort(byName)
}

/** One profile — approved for everyone; pending/hidden only for its owner/admin. */
export async function fetchArtistBySlug(slug: string): Promise<Artist | null> {
  const { data, error } = await supabase
    .from('artists')
    .select(ARTIST_COLS)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return (data as Artist | null) ?? null
}

// ── owner ────────────────────────────────────────────────────────────────────

export async function fetchMyArtist(userId: string): Promise<Artist | null> {
  const { data, error } = await supabase
    .from('artists')
    .select(ARTIST_COLS)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as Artist | null) ?? null
}

/** Self-service create: the guard forces status='pending' and ownership. */
export async function createMyArtist(input: ArtistInput): Promise<Artist> {
  const { data, error } = await supabase.from('artists').insert(input).select(ARTIST_COLS).single()
  if (error) throw error
  return data as Artist
}

export async function updateArtist(id: string, input: Partial<ArtistInput>): Promise<Artist> {
  const { data, error } = await supabase
    .from('artists')
    .update(input)
    .eq('id', id)
    .select(ARTIST_COLS)
  if (error) throw error
  if (!data || data.length === 0) throw new Error('not updated')
  return data[0] as Artist
}

/** Uploads a photo or PDF to artists/{uid}/… and returns its public URL. */
export async function uploadArtistFile(
  userId: string,
  file: File,
  kind: 'photo' | 'doc',
): Promise<string> {
  const ext = (file.name.split('.').pop() || (kind === 'doc' ? 'pdf' : 'jpg'))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const rand = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const path = `${userId}/${kind}-${rand}.${ext}`
  const { error } = await supabase.storage
    .from('artists')
    .upload(path, file, { contentType: file.type, cacheControl: '2592000' })
  if (error) throw error
  return supabase.storage.from('artists').getPublicUrl(path).data.publicUrl
}

// ── claims ("este perfil soy yo") ────────────────────────────────────────────

export type ClaimStatus = 'pending' | 'approved' | 'rejected'

export type MyClaim = {
  id: string
  status: ClaimStatus
  created_at: string
  artist: { name: string; slug: string } | null
}

/** Approved profiles nobody has linked yet — the ones a new user can claim. */
export async function fetchClaimable(): Promise<ArtistCard[]> {
  const { data, error } = await supabase
    .from('artists')
    .select(CARD_COLS)
    .eq('status', 'approved')
    .is('user_id', null)
  if (error) throw error
  return ((data ?? []) as ArtistCard[]).sort(byName)
}

export async function fetchMyClaims(): Promise<MyClaim[]> {
  const { data, error } = await supabase
    .from('artist_claims')
    .select('id, status, created_at, artist:artists(name, slug)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as MyClaim[]
}

/** Plain insert (user_id defaults to auth.uid()); RLS checks the profile is
 *  approved + unclaimed and that the user owns none. */
export async function submitClaim(artistId: string, message: string | null): Promise<void> {
  const { error } = await supabase
    .from('artist_claims')
    .insert({ artist_id: artistId, message: message?.trim() || null })
  if (error) throw error
}

export async function cancelClaim(claimId: string): Promise<void> {
  const { error } = await supabase.from('artist_claims').delete().eq('id', claimId)
  if (error) throw error
}

// ── admin / super ────────────────────────────────────────────────────────────

export type AdminArtist = Artist & { owner: { display_name: string | null } | null }

export async function fetchAllArtistsAdmin(): Promise<AdminArtist[]> {
  const { data, error } = await supabase
    .from('artists')
    .select(`${ARTIST_COLS}, owner:profiles(display_name)`)
  if (error) throw error
  return ((data ?? []) as unknown as AdminArtist[]).sort(byName)
}

/** Admin-created profiles are published right away and stay unclaimed. */
export async function createArtistAdmin(input: ArtistInput): Promise<Artist> {
  const { data, error } = await supabase
    .from('artists')
    .insert({ ...input, status: 'approved' })
    .select(ARTIST_COLS)
    .single()
  if (error) throw error
  return data as Artist
}

export async function setArtistStatus(id: string, status: ArtistStatus): Promise<void> {
  const { data, error } = await supabase.from('artists').update({ status }).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('not updated')
}

export async function unlinkArtistOwner(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('artists')
    .update({ user_id: null })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('not updated')
}

export async function deleteArtist(id: string): Promise<void> {
  const { error } = await supabase.from('artists').delete().eq('id', id)
  if (error) throw error
}

export type PendingClaim = {
  id: string
  artist_id: string
  artist_name: string
  artist_slug: string
  artist_image: string | null
  user_id: string
  display_name: string | null
  email: string | null
  message: string | null
  created_at: string
}

export async function fetchPendingClaims(): Promise<PendingClaim[]> {
  const { data, error } = await supabase.rpc('artist_claims_admin')
  if (error) throw error
  return (data ?? []) as PendingClaim[]
}

export async function reviewClaim(claimId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('review_artist_claim', {
    p_claim_id: claimId,
    p_approve: approve,
  })
  if (error) throw error
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Accent/case-insensitive form for search ("tepe" finds "Tepé", "zepol" ZĒPØL). */
export function foldText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .toLowerCase()
}

/** "instagram.com/x" → "https://instagram.com/x"; null if not a web URL. */
export function normalizeUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s || /\s/.test(s)) return null
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

export function isSoundcloudUrl(url: string): boolean {
  return /^https:\/\/(www\.|m\.|on\.)?soundcloud\.com\/\S+$/i.test(url)
}

/** Best-guess label for a pasted link, so most people never type one. */
export function guessLinkLabel(url: string): string {
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Web'
  }
  const known: [RegExp, string][] = [
    [/instagram\.com$/, 'Instagram'],
    [/soundcloud\.com$/, 'SoundCloud'],
    [/spotify\.com$/, 'Spotify'],
    [/bandcamp\.com$/, 'Bandcamp'],
    [/(^|\.)ra\.co$|residentadvisor\.net$/, 'Resident Advisor'],
    [/youtube\.com$|youtu\.be$/, 'YouTube'],
    [/beatport\.com$/, 'Beatport'],
    [/mixcloud\.com$/, 'Mixcloud'],
    [/tiktok\.com$/, 'TikTok'],
    [/facebook\.com$/, 'Facebook'],
    [/(twitter|x)\.com$/, 'X'],
    [/linktr\.ee$/, 'Linktree'],
    [/behance\.net$/, 'Behance'],
    [/linkedin\.com$/, 'LinkedIn'],
  ]
  return known.find(([re]) => re.test(host))?.[1] ?? 'Web'
}

/** SoundCloud widget URL in the site's palette (compact, no artwork). */
export function soundcloudEmbedUrl(url: string): string {
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    url,
  )}&color=%23171616&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`
}

/** Supabase/Postgres error → message a person can act on. */
export function artistErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string } | null
  const msg = err?.message ?? ''
  if (err?.code === '23505') {
    if (/artists_user_id_key/.test(msg) || /owns an artist/.test(msg))
      return 'Esta cuenta ya tiene un perfil de artista.'
    if (/artist_claims_one_pending/.test(msg))
      return 'Ya tienes una solicitud en revisión. Espera la respuesta o cancélala.'
    if (/already claimed/.test(msg)) return 'Ese perfil ya fue vinculado a otra cuenta.'
    return 'Ya existe un registro igual.'
  }
  if (err?.code === '42501' || /row-level security/.test(msg))
    return 'No tienes permiso para hacer esto (¿el perfil ya fue vinculado?).'
  if (/invalid link/.test(msg)) return 'Revisa los links: deben ser direcciones web completas.'
  if (/invalid track/.test(msg)) return 'Las pistas deben ser links de SoundCloud.'
  if (/invalid document/.test(msg)) return 'Revisa los documentos: cada uno necesita un nombre.'
  if (/too long|1-80/.test(msg)) return 'Algún texto es demasiado largo.'
  if (/mime|file type|not allowed/i.test(msg)) return 'Formato de archivo no permitido.'
  if (/size|too large|exceeded/i.test(msg)) return 'El archivo es demasiado pesado.'
  return 'Algo salió mal. Intenta de nuevo.'
}
