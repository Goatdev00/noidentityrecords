import { supabase } from './supabase'
import { slugify } from './panel'

/** Super/admin data layer for events and merch. Every call runs under the
 *  caller's JWT; RLS (is_admin, which now includes is_super) is the real gate. */

// ── events ───────────────────────────────────────────────────────────────────

export type AdminEvent = {
  id: string
  title: string
  subtitle: string | null
  venue: string | null
  event_date: string // YYYY-MM-DD
  ticket_url: string | null
  image_url: string | null
  active: boolean
  created_at: string
}

export type EventInput = {
  title: string
  subtitle: string | null
  venue: string | null
  event_date: string
  ticket_url: string | null
  image_url: string | null
  active: boolean
}

const EVENT_COLS =
  'id, title, subtitle, venue, event_date, ticket_url, image_url, active, created_at'

/** All events (incl. past + inactive) for management, soonest date last. */
export async function fetchAllEventsAdmin(): Promise<AdminEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLS)
    .order('event_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as AdminEvent[]
}

export async function createEvent(input: EventInput): Promise<AdminEvent> {
  const { data, error } = await supabase.from('events').insert(input).select(EVENT_COLS).single()
  if (error) throw error
  return data as AdminEvent
}

export async function updateEvent(id: string, input: Partial<EventInput>): Promise<void> {
  const { error, data } = await supabase.from('events').update(input).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('not updated')
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}

// ── products (merch) ─────────────────────────────────────────────────────────

export type AdminVariant = { id: string; size: string; stock: number }

export type AdminProduct = {
  id: string
  slug: string
  name: string
  description: string | null
  price_cop: number
  images: string[]
  active: boolean
  created_at: string
  variants: AdminVariant[]
}

const PRODUCT_COLS =
  'id, slug, name, description, price_cop, images, active, created_at, variants:product_variants(id, size, stock)'

/** Every product (active or not) with its variants. */
export async function fetchAllProductsAdmin(): Promise<AdminProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((p) => ({
    ...(p as AdminProduct),
    images: (p as AdminProduct).images ?? [],
    variants: (p as AdminProduct).variants ?? [],
  }))
}

export type ProductInput = {
  name: string
  description: string | null
  price_cop: number
  images: string[]
  active: boolean
}

/** Unique slug from the name (appends a short suffix on collision). */
async function uniqueSlug(name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name) || 'producto'
  let slug = base
  for (let i = 0; i < 20; i++) {
    let q = supabase.from('products').select('id').eq('slug', slug)
    if (ignoreId) q = q.neq('id', ignoreId)
    const { data } = await q.maybeSingle()
    if (!data) return slug
    slug = `${base}-${i + 2}`
  }
  return `${base}-${Math.floor(performance.now())}`
}

export async function createProduct(input: ProductInput): Promise<AdminProduct> {
  const slug = await uniqueSlug(input.name)
  const { data, error } = await supabase
    .from('products')
    .insert({ ...input, slug })
    .select(PRODUCT_COLS)
    .single()
  if (error) throw error
  return { ...(data as AdminProduct), images: (data as AdminProduct).images ?? [], variants: [] }
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<void> {
  const patch: Record<string, unknown> = { ...input }
  if (input.name) patch.slug = await uniqueSlug(input.name, id)
  const { error, data } = await supabase.from('products').update(patch).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('not updated')
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

// ── variants (sizes / stock) ─────────────────────────────────────────────────

export async function addVariant(
  productId: string,
  size: string,
  stock: number,
): Promise<AdminVariant> {
  const { data, error } = await supabase
    .from('product_variants')
    .insert({ product_id: productId, size: size.trim().toUpperCase(), stock })
    .select('id, size, stock')
    .single()
  if (error) throw error
  return data as AdminVariant
}

export async function updateVariantStock(variantId: string, stock: number): Promise<void> {
  const { error } = await supabase
    .from('product_variants')
    .update({ stock })
    .eq('id', variantId)
  if (error) throw error
}

export async function deleteVariant(variantId: string): Promise<void> {
  const { error } = await supabase.from('product_variants').delete().eq('id', variantId)
  if (error) throw error
}

// ── podcast / media embeds ───────────────────────────────────────────────────

export type AdminEmbed = {
  id: string
  platform: 'bandcamp' | 'soundcloud'
  title: string
  meta: string | null
  embed_url: string
  height: number
  active: boolean
  created_at: string
}

const EMBED_COLS = 'id, platform, title, meta, embed_url, height, active, created_at'

/** A Record Label content section that is uploaded/managed from Gestión. */
export type MediaSection = 'podcast' | 'specials'

/** Media in a section, newest first — matches how the site orders them. */
export async function fetchMediaAdmin(section: MediaSection): Promise<AdminEmbed[]> {
  const { data, error } = await supabase
    .from('media_embeds')
    .select(EMBED_COLS)
    .eq('section', section)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AdminEmbed[]
}

/**
 * Turns whatever the user pastes — a plain SoundCloud/Bandcamp track URL, the
 * full <iframe> share snippet, or an already-built player URL — into the
 * iframe `src`. Returns null when it can't recognise a supported link.
 */
export function buildEmbedUrl(
  raw: string,
): { embed_url: string; platform: 'bandcamp' | 'soundcloud'; height: number } | null {
  const trimmed = (raw || '').trim()
  if (!trimmed) return null
  // pull the src out of a pasted <iframe …>
  const src = trimmed.match(/src\s*=\s*["']([^"']+)["']/i)?.[1] ?? trimmed

  if (/w\.soundcloud\.com\/player/i.test(src)) {
    return { embed_url: src, platform: 'soundcloud', height: 280 }
  }
  if (/soundcloud\.com\//i.test(src)) {
    const clean = src.split('?')[0]
    const enc = encodeURIComponent(clean)
    return {
      embed_url: `https://w.soundcloud.com/player/?url=${enc}&color=%23171616&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`,
      platform: 'soundcloud',
      height: 280,
    }
  }
  if (/bandcamp\.com\/EmbeddedPlayer/i.test(src)) {
    return { embed_url: src, platform: 'bandcamp', height: 654 }
  }
  return null
}

export type MediaInput = {
  title: string
  meta: string | null
  source: string // whatever the user pasted
  section: MediaSection
}

export async function createMediaEmbed(input: MediaInput): Promise<AdminEmbed> {
  const built = buildEmbedUrl(input.source)
  if (!built) throw new Error('Link no reconocido. Pega un enlace de SoundCloud o Bandcamp.')
  const defaultTitle = input.section === 'podcast' ? 'Podcast Sessions' : ''
  const { data, error } = await supabase
    .from('media_embeds')
    .insert({
      platform: built.platform,
      title: input.title.trim() || defaultTitle,
      meta: input.meta?.trim() || null,
      embed_url: built.embed_url,
      height: built.height,
      section: input.section,
      active: true,
      position: 0,
    })
    .select(EMBED_COLS)
    .single()
  if (error) throw error
  return data as AdminEmbed
}

export async function updateMediaEmbed(
  id: string,
  patch: { title?: string; meta?: string | null; active?: boolean; source?: string },
): Promise<void> {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = patch.title.trim() || 'Podcast Sessions'
  if (patch.meta !== undefined) body.meta = patch.meta?.trim() || null
  if (patch.active !== undefined) body.active = patch.active
  if (patch.source) {
    const built = buildEmbedUrl(patch.source)
    if (!built) throw new Error('Link no reconocido.')
    body.embed_url = built.embed_url
    body.platform = built.platform
    body.height = built.height
  }
  const { error, data } = await supabase
    .from('media_embeds')
    .update(body)
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('not updated')
}

export async function deleteMediaEmbed(id: string): Promise<void> {
  const { error } = await supabase.from('media_embeds').delete().eq('id', id)
  if (error) throw error
}

// ── image upload (shared merch-images bucket, admin-writable) ─────────────────

/** Uploads to merch-images/{prefix}/… and returns the public URL. */
export async function uploadMerchImage(file: File, prefix = 'merch'): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const rand = Math.floor(performance.now()).toString(36)
  const path = `${prefix}/${rand}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from('merch-images')
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '2592000' })
  if (error) throw error
  const { data } = supabase.storage.from('merch-images').getPublicUrl(path)
  return data.publicUrl
}
