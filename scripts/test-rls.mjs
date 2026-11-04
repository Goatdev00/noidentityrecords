// RLS smoke test — runs with the PUBLIC anon key only (safe to re-run anytime):
//   node scripts/test-rls.mjs
// Verifies the brief's §15 mandate from the outside: an anonymous client must
// never read lesson_content (except each course's free first lesson), insert
// enrollments, or see private rows.
const REF = process.env.SUPABASE_REF ?? 'ztzgnorjnffpgytnwnvy'
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_eScEZXS_8OyryL3_xvudVA_1yKkinmt' // public by design
const REST = `https://${REF}.supabase.co/rest/v1`

async function anon(path, opts = {}) {
  const res = await fetch(`${REST}/${path}`, {
    ...opts,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  return { status: res.status, body: (await res.text()).slice(0, 300) }
}

const results = []
const check = (name, ok, detail) => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`)
}

// The only lesson_content anon may read is each published course's free
// preview lesson (its first lesson) — never any other row.
const lcRes = await fetch(`${REST}/lesson_content?select=lesson_id`, {
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
})
const lcRows = lcRes.ok ? await lcRes.json() : null
const coursesRes = await fetch(`${REST}/courses?select=id`, {
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
})
const allowed = new Set()
for (const c of coursesRes.ok ? await coursesRes.json() : []) {
  const r = await fetch(`${REST}/rpc/preview_lesson_id`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_course_id: c.id }),
  })
  const id = r.ok ? await r.json() : null
  if (id) allowed.add(id)
}
const leaked = (lcRows ?? []).filter((r) => !allowed.has(r.lesson_id))
check('anon reads only free preview lesson_content', lcRows !== null && leaked.length === 0,
  `status=${lcRes.status} rows=${lcRows?.length} preview=${allowed.size} leaked=${leaked.length}`)

const enr = await anon('enrollments', {
  method: 'POST',
  body: JSON.stringify({
    user_id: '00000000-0000-4000-8000-000000000000',
    course_id: '00000000-0000-4000-8000-000000000000',
  }),
})
check('anon cannot insert enrollments', enr.status === 401 || enr.status === 403,
  `status=${enr.status}`)

const pay = await anon('payments?select=*')
check('anon sees zero payments', pay.status === 200 && pay.body === '[]',
  `status=${pay.status} body=${pay.body}`)

const ords = await anon('orders?select=*')
check('anon sees zero orders', ords.status === 200 && ords.body === '[]',
  `status=${ords.status} body=${ords.body}`)

const certs = await anon('certificates?select=*')
check('anon sees zero certificates', certs.status === 200 && certs.body === '[]',
  `status=${certs.status} body=${certs.body}`)

// artist catalog: only approved profiles are public, claim requests never are
const hiddenArtists = await anon('artists?select=id&status=neq.approved')
check('anon sees zero pending/hidden artists', hiddenArtists.status === 200 && hiddenArtists.body === '[]',
  `status=${hiddenArtists.status} body=${hiddenArtists.body}`)

const artistClaims = await anon('artist_claims?select=*')
check('anon sees zero artist claims', artistClaims.status === 200 && artistClaims.body === '[]',
  `status=${artistClaims.status} body=${artistClaims.body}`)

const spamArtist = await anon('artists', { method: 'POST', body: JSON.stringify({ name: 'rls-test' }) })
check('anon cannot create artists', spamArtist.status === 401 || spamArtist.status === 403,
  `status=${spamArtist.status}`)

const emb = await anon('media_embeds?select=title&active=eq.true&limit=1')
check('anon can read active media_embeds', emb.status === 200 && emb.body !== '[]',
  `status=${emb.status} body=${emb.body}`)

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
