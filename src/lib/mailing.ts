import { supabase } from './supabase'

export type Contact = { id: string; email: string; name: string | null; created_at: string }
export type Group = { id: string; name: string; created_at: string; member_count?: number }

export type Campaign = {
  id: string
  subject: string
  from_name: string
  from_email: string
  reply_to: string | null
  image_url: string | null
  heading: string | null
  tagline: string | null
  body: string | null
  cta_label: string | null
  cta_url: string | null
  target: 'all' | 'group' | 'individual'
  group_id: string | null
  individual_email: string | null
  status: 'draft' | 'queued' | 'sending' | 'sent' | 'failed'
  recipients_count: number
  error: string | null
  sent_at: string | null
  created_at: string
}

export type CampaignDraft = Omit<
  Campaign,
  'id' | 'status' | 'recipients_count' | 'error' | 'sent_at' | 'created_at'
>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Parse an uploaded Excel (.xlsx/.xls) or CSV into [{email,name}]. Layout-
 * agnostic: for each row it picks the first cell that looks like an email and
 * the first text cell that isn't the email/a phone as the name. xlsx is
 * imported lazily so it stays out of the main bundle.
 */
export async function parseContactsFile(
  file: File,
): Promise<{ email: string; name: string | null }[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })
  const out: { email: string; name: string | null }[] = []
  for (const row of rows) {
    if (!Array.isArray(row)) continue
    const cells = row.map((c) => (c == null ? '' : String(c)).trim())
    const email = cells.find((c) => EMAIL_RE.test(c.toLowerCase()))
    if (!email) continue
    const name =
      cells.find(
        (c) => c && c !== email && !EMAIL_RE.test(c.toLowerCase()) && !/^[\d\s+()./-]+$/.test(c),
      ) ?? null
    out.push({ email, name })
  }
  return out
}

/** Clean + dedupe an incoming [{email,name}] list before saving. */
export function normalizeContacts(
  raw: { email: string; name?: string | null }[],
): { email: string; name: string | null }[] {
  const map = new Map<string, string | null>()
  for (const r of raw) {
    const email = (r.email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) continue
    if (!map.has(email)) map.set(email, (r.name ?? '')?.toString().trim() || null)
  }
  return [...map].map(([email, name]) => ({ email, name }))
}

// ── contacts ────────────────────────────────────────────────────────────────

export async function fetchContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('mailing_contacts')
    .select('id, email, name, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Save contacts, keeping the ones already stored (ignore duplicates by email).
 * Returns how many were newly added vs already existed.
 */
export async function saveContacts(
  raw: { email: string; name?: string | null }[],
): Promise<{ total: number; added: number; duplicates: number }> {
  const clean = normalizeContacts(raw)
  if (clean.length === 0) return { total: 0, added: 0, duplicates: 0 }
  const { data, error } = await supabase
    .from('mailing_contacts')
    .upsert(clean, { onConflict: 'email', ignoreDuplicates: true })
    .select('id')
  if (error) throw error
  const added = data?.length ?? 0
  return { total: clean.length, added, duplicates: clean.length - added }
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('mailing_contacts').delete().eq('id', id)
  if (error) throw error
}

// ── groups ──────────────────────────────────────────────────────────────────

export async function fetchGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from('mailing_groups')
    .select('id, name, created_at, members:mailing_group_members(count)')
    .order('created_at', { ascending: false })
  if (error) throw error
  // deno-lint style flatten of the aggregate
  return (data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    created_at: g.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    member_count: (g as any).members?.[0]?.count ?? 0,
  }))
}

export async function createGroup(name: string): Promise<Group> {
  const { data, error } = await supabase
    .from('mailing_groups')
    .insert({ name })
    .select('id, name, created_at')
    .single()
  if (error) throw error
  return { ...data, member_count: 0 }
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await supabase.from('mailing_groups').delete().eq('id', id)
  if (error) throw error
}

/** Add the given contacts to a group (idempotent). */
export async function addToGroup(groupId: string, contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return
  const rows = contactIds.map((contact_id) => ({ group_id: groupId, contact_id }))
  const { error } = await supabase
    .from('mailing_group_members')
    .upsert(rows, { onConflict: 'group_id,contact_id', ignoreDuplicates: true })
  if (error) throw error
}

/** Save an uploaded list straight into a group: saves contacts, then links them. */
export async function saveContactsToGroup(
  groupId: string,
  raw: { email: string; name?: string | null }[],
): Promise<{ total: number; added: number; duplicates: number }> {
  const result = await saveContacts(raw)
  // link ALL matching contacts (new + existing) to the group
  const emails = normalizeContacts(raw).map((c) => c.email)
  if (emails.length > 0) {
    const { data } = await supabase.from('mailing_contacts').select('id').in('email', emails)
    await addToGroup(groupId, (data ?? []).map((c) => c.id))
  }
  return result
}

// ── campaigns ─────────────────────────────────────────────────────────────

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('mailing_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Campaign[]
}

export async function fetchCampaign(id: string): Promise<Campaign | null> {
  const { data, error } = await supabase.from('mailing_campaigns').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Campaign) ?? null
}

export async function saveCampaign(
  draft: Partial<CampaignDraft>,
  id?: string,
): Promise<Campaign> {
  if (id) {
    const { data, error } = await supabase
      .from('mailing_campaigns')
      .update(draft)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as Campaign
  }
  const { data, error } = await supabase
    .from('mailing_campaigns')
    .insert(draft)
    .select('*')
    .single()
  if (error) throw error
  return data as Campaign
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('mailing_campaigns').delete().eq('id', id)
  if (error) throw error
}

/** Fires the send-campaign Edge Function (does the real Resend send server-side). */
export async function sendCampaign(campaignId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-campaign', {
    body: { campaign_id: campaignId },
  })
  if (error) {
    let message = 'No se pudo enviar la campaña.'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) {
        const body = await ctx.json()
        if (body?.error) message = body.error
      }
    } catch {
      /* keep default */
    }
    throw new Error(message)
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
}

/** Sends the campaign as a [PRUEBA] email to one address (no status change). */
export async function sendCampaignTest(campaignId: string, testTo: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-campaign', {
    body: { campaign_id: campaignId, test_to: testTo },
  })
  if (error) {
    let message = 'No se pudo enviar la prueba.'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) {
        const body = await ctx.json()
        if (body?.error) message = body.error
      }
    } catch {
      /* keep default */
    }
    throw new Error(message)
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
}

/** Upload a campaign image to the public `mailing` bucket, return its URL. */
export async function uploadCampaignImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from('mailing')
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '2592000' })
  if (error) throw error
  const { data } = supabase.storage.from('mailing').getPublicUrl(path)
  return data.publicUrl
}
