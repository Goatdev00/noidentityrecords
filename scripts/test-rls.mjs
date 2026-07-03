// RLS smoke test — runs with the PUBLIC anon key only (safe to re-run anytime):
//   node scripts/test-rls.mjs
// Verifies the brief's §15 mandate from the outside: an anonymous client must
// never read lesson_content, insert enrollments, or see private rows.
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

const lc = await anon('lesson_content?select=*')
check('anon cannot read lesson_content', lc.status === 200 && lc.body === '[]',
  `status=${lc.status} body=${lc.body}`)

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

const emb = await anon('media_embeds?select=title&active=eq.true&limit=1')
check('anon can read active media_embeds', emb.status === 200 && emb.body !== '[]',
  `status=${emb.status} body=${emb.body}`)

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
