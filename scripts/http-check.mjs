import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const origin = new URL(process.argv[2] || 'http://127.0.0.1:18081')
const legacy = JSON.parse(readFileSync('scripts/legacy-anchors.json', 'utf8'))
let requests = 0
async function request(path, status = 200, method = 'GET') {
  const response = await fetch(new URL(path, origin), { method, redirect: 'manual', signal: AbortSignal.timeout(5000) })
  assert.equal(response.status, status, method + ' ' + path)
  const policy = response.headers.get('content-security-policy') || ''
  assert.match(policy, /default-src 'none'/, path + ': missing CSP')
  assert.match(policy, /script-src-attr 'none'/, path + ': inline event handlers allowed')
  assert.match(policy, /frame-ancestors 'none'/, path + ': framing allowed')
  assert.doesNotMatch(policy.match(/(?:^|; )script-src [^;]+/)?.[0] || '', /'unsafe-inline'|'unsafe-eval'/)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(response.headers.get('x-frame-options'), 'DENY')
  assert.doesNotMatch(response.headers.get('server') || '', /\d/)
  requests++
  return response
}

for (const path of ['/', '/index.html', '/download.html', ...Object.keys(legacy).map(path => '/' + path)]) {
  const response = await request(path)
  assert.match(response.headers.get('content-type') || '', /text\/html/)
  assert.match(await response.text(), /SingVerse/)
}
for (const path of Object.keys(legacy)) await request('/' + path.replace(/\.html$/, ''))
assert.equal((await request('/docs', 308)).headers.get('location'), '/docs/index.html')
assert.equal(await (await request('/healthz')).text(), 'ok\n')
for (const path of ['/does-not-exist', '/.env', '/.git/config', '/src/content/docs/security.md', '/package-lock.json']) {
  await request(path, 404)
}
for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) await request('/', 405, method)
await request('/', 200, 'HEAD')
await request('/assets/brand/logo-mark.svg')
await request('/pagefind/pagefind.js')
const index = await (await request('/pagefind/pagefind-entry.json')).json()
assert.equal(Object.values(index.languages).reduce((sum, language) => sum + language.page_count, 0), Object.keys(legacy).length + 2, 'Search index should contain all public pages without aliases/404')
for (const language of Object.values(index.languages)) {
  const wasm = await request('/pagefind/wasm.' + (language.wasm || 'unknown') + '.pagefind')
  assert.match(wasm.headers.get('content-type') || '', /application\/octet-stream/)
}
console.log('HTTP checks passed:', { origin: origin.origin, requests })
