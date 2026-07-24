// manage-enrollment — super-admin grants / revokes course access.
//
// enrollments are revoked from anon+authenticated by design (granting yourself
// a paid course would be trivial otherwise), so every write goes through here
// under the service role, gated on the caller being is_super. Emails live in
// auth.users, so the people picker is served from here too.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  try {
    const { action, course_id, user_id, email } = await req.json().catch(() => ({}))

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'No autenticado' }, 401)

    const admin = createClient(url, service)
    const { data: prof } = await admin.from('profiles').select('is_super').eq('id', user.id).maybeSingle()
    if (!prof?.is_super) return json({ error: 'No autorizado' }, 403)

    // ── people picker: every account, with email (auth) + name (profiles) ──
    if (action === 'users') {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const { data: profiles } = await admin.from('profiles').select('id, display_name, role')
      const byId = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]))
      const users = (list?.users ?? []).map((u) => ({
        id: u.id,
        email: u.email ?? '',
        display_name: (byId.get(u.id) as { display_name?: string } | undefined)?.display_name ?? null,
        role: (byId.get(u.id) as { role?: string } | undefined)?.role ?? 'student',
      }))
      users.sort((a, b) => (a.display_name ?? a.email).localeCompare(b.display_name ?? b.email))
      return json({ users })
    }

    // ── who is enrolled in a course ──
    if (action === 'list') {
      if (!course_id) return json({ error: 'course_id requerido' }, 400)
      const { data: rows } = await admin
        .from('enrollments')
        .select('id, user_id, payment_id, created_at')
        .eq('course_id', course_id)
        .order('created_at', { ascending: false })
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const emailById = new Map((list?.users ?? []).map((u) => [u.id, u.email ?? '']))
      const { data: profiles } = await admin.from('profiles').select('id, display_name')
      const nameById = new Map((profiles ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]))
      const students = (rows ?? []).map((r: { id: string; user_id: string; payment_id: string | null; created_at: string }) => ({
        id: r.id,
        user_id: r.user_id,
        email: emailById.get(r.user_id) ?? '',
        display_name: nameById.get(r.user_id) ?? null,
        // no payment row = access granted by hand from Gestión
        manual: r.payment_id === null,
        created_at: r.created_at,
      }))
      return json({ students })
    }

    // ── grant access (by user_id or email) ──
    if (action === 'grant') {
      if (!course_id) return json({ error: 'Elige un curso.' }, 400)
      let target = user_id as string | undefined
      if (!target && email) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const found = (list?.users ?? []).find(
          (u) => (u.email ?? '').toLowerCase() === String(email).trim().toLowerCase(),
        )
        if (!found) {
          return json({ error: 'No hay ninguna cuenta con ese correo. La persona debe registrarse primero.' }, 404)
        }
        target = found.id
      }
      if (!target) return json({ error: 'Elige a la persona.' }, 400)

      const { error } = await admin
        .from('enrollments')
        .upsert({ user_id: target, course_id, payment_id: null }, { onConflict: 'user_id,course_id', ignoreDuplicates: true })
      if (error) return json({ error: `No se pudo dar el acceso: ${error.message}` }, 500)
      return json({ status: 'granted', user_id: target })
    }

    // ── revoke access ──
    if (action === 'revoke') {
      if (!course_id || !user_id) return json({ error: 'Faltan datos.' }, 400)
      const { error } = await admin
        .from('enrollments')
        .delete()
        .eq('course_id', course_id)
        .eq('user_id', user_id)
      if (error) return json({ error: `No se pudo quitar el acceso: ${error.message}` }, 500)
      return json({ status: 'revoked' })
    }

    return json({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    return json({ error: `Error: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
