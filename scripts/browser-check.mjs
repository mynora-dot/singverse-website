// Real Chromium checks against the built static site and its generated CSP.
// CHROME_BIN may select an installed Chrome/Chromium; no browser dependency download.
import { createServer } from 'node:http'
import { readFile, writeFile, mkdtemp, readdir, mkdir } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { defaults, generate } from '../src/lib/deployment/compose.mjs'
const report = await mkdtemp(join(tmpdir(), 'singverse-website-browser-'))
console.log('Browser QA artifacts:', report)
const profile = join(report, 'chrome-profile'), downloads = join(report, 'downloads')
await mkdir(downloads)
const security = JSON.parse(await readFile('.build/security-report.json', 'utf8'))
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2', '.yaml':'application/yaml' }
const server = createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', security.policy)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  const pathname = decodeURIComponent(new URL(req.url, 'http://local.invalid').pathname)
  const choices = pathname === '/' ? ['index.html'] : [pathname.slice(1), pathname.slice(1)+'.html', pathname.slice(1)+'/index.html']
  for (const choice of choices) {
    const file = resolve('dist', choice)
    if (!file.startsWith(resolve('dist')+'/')) continue
    try { const body = await readFile(file); res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(body); return } catch { /* next static route */ }
  }
  res.writeHead(404); res.end('Not found')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port
const chrome = spawn(process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let socket, sequence = 0, cdp
const failures = [], requests = []
const pending = new Map()
async function until(check, message, timeout = 15000) { const start = Date.now(); while (Date.now()-start < timeout) { const value = await check(); if (value) return value; await delay(100) } throw new Error(message) }
try {
  const port = await until(async () => { try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0] } catch { return false } }, 'Chrome did not start')
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, {once:true}); socket.addEventListener('error', reject, {once:true}) })
  socket.addEventListener('message', event => {
    const value = JSON.parse(event.data)
    if (value.id) { const entry = pending.get(value.id); if (entry) { pending.delete(value.id); value.error ? entry.reject(new Error(JSON.stringify(value.error))) : entry.resolve(value.result) } }
    if (value.method === 'Runtime.exceptionThrown') failures.push(value.params.exceptionDetails)
    if (value.method === 'Log.entryAdded' && value.params.entry.level === 'error') failures.push(value.params.entry)
    if (value.method === 'Network.requestWillBeSent') requests.push(value.params.request.url)
  })
  cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, {resolve,reject}); socket.send(JSON.stringify({id,method,params})) })
  const evaluate = async expression => { const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value }
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Log.enable'); await cdp('Network.enable')
  await cdp('Page.bringToFront')
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
  await cdp('Browser.setDownloadBehavior', {behavior:'allow',downloadPath:downloads})
  await cdp('Browser.grantPermissions', {origin,permissions:['clipboardReadWrite','clipboardSanitizedWrite']})
  const viewport = (width, height) => cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600})
  const visit = async path => { await cdp('Page.navigate',{url:origin+path}); await until(() => evaluate('document.readyState === "complete"'), 'Page failed to load'); await delay(200) }
  const set = async (name, value) => evaluate(`(() => {const e=document.querySelector('[name="${name}"]'); e.value=${JSON.stringify(value)}; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  const yaml = () => evaluate('document.querySelector("#compose-output").value')
  const storage = () => evaluate('({local: {...localStorage}, session: {...sessionStorage}})')
  const overflow = () => evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
  await viewport(1536,1100)
  await visit('/docs/compose.html')
  const initialStorage = await storage()
  assert.equal(await yaml(), generate(defaults()))
  await writeFile(join(report,'compose-desktop.png'), Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'))
  for (const hardware of ['amd780m','intel','rk3566','a3000']) {
    await click(`[name="hardware"][value="${hardware}"]`)
    assert.equal(await yaml(), generate(defaults(hardware)), hardware + ': browser and library output differ')
  }
  await click('[name="hardware"][value="rk3566"]')
  await click('[name="mpp"]')
  assert.match(await yaml(), /mpp_service/)
  await set('mode','app'); await set('arch','arm64')
  assert.doesNotMatch(await yaml(), /^  singverse-compute:/m)
  assert.match(await yaml(), /linux\/arm64/)
  await set('database','mysql')
  assert.equal(await evaluate('document.querySelector("[data-download]").disabled'), true)
  assert.equal(await yaml(), '')
  await set('mysqlHost','db.internal')
  const password = 'synthetic-$HOME-${TEST}-$$-"-中文'
  await set('mysqlPassword',password)
  assert.match(await yaml(), /\$\$HOME-\$\$\{TEST\}-\$\$\$\$/)
  await set('port','0')
  assert.equal(await evaluate('document.querySelector("[name=port]").getAttribute("aria-invalid")'), 'true')
  assert.equal(await yaml(), '')
  await set('port','18222')
  const expected = await yaml()
  assert.match(expected, /18222/)
  await cdp('Page.bringToFront')
  await click('[data-copy]')
  await until(() => evaluate('document.querySelector("[data-action-status]").textContent.includes("已复制")'), 'Copy did not finish')
  assert.equal(await evaluate('navigator.clipboard.readText()'), expected)
  await click('[data-download]')
  await until(async () => (await readdir(downloads)).includes('docker-compose.yaml'), 'YAML download did not complete')
  assert.equal(await readFile(join(downloads,'docker-compose.yaml'),'utf8'), expected)
  assert.deepEqual(await storage(), initialStorage, 'Generator persisted configuration in browser storage')
  await click('[type=reset]')
  assert.equal(await yaml(), generate(defaults('rk3566')))
  await set('mode','node')
  assert.doesNotMatch(await yaml(), /^  singverse-go-backend:/m)
  assert.match(await yaml(), /18090/)
  await click('[name="hardware"][value="amd780m"]')
  assert.match(await yaml(), /name: "singverse-compute-node"/)
  await viewport(390,844)
  await visit('/docs/compose.html')
  assert.ok(await overflow(), 'Generator mobile horizontal overflow')
  await writeFile(join(report,'compose-mobile.png'), Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'))
  await click('[name="hardware"][value="amd780m"]')
  await evaluate('document.querySelector("[data-download]").scrollIntoView({block:"center"})')
  assert.ok(await overflow())
  assert.match(await yaml(), /latest-rocm/)
  await writeFile(join(report,'compose-mobile-preview.png'), Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'))
  const guides = (await readdir('src/content/docs')).filter(file=>/\.mdx?$/.test(file)).map(file=>file.replace(/\.mdx?$/, ''))
  for (const width of [390,1536]) {
    await viewport(width,width===390?844:1100)
    for (const guide of guides) {
      await visit(`/docs/${guide}.html`)
      assert.ok(await overflow(), `${guide}: ${width}px horizontal overflow`)
      assert.equal(await evaluate('document.querySelectorAll("h1").length'),1)
    }
  }
  await visit('/docs/parameters.html')
  await writeFile(join(report,'parameters-desktop.png'), Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'))
  await evaluate('document.querySelector("[data-search-open]").click()')
  await until(() => evaluate('!!document.querySelector(".search-dialog[open]")'), 'Search dialog not open')
  await evaluate('(() => { const e=document.querySelector(".search-dialog input"); e.value="COMPUTE_AUDIO_MEMORY_BYTES"; e.dispatchEvent(new Event("input",{bubbles:true})); })()')
  await until(() => evaluate('document.querySelectorAll(".search-result").length > 0'), 'Search index returned no parameter results')
  assert.ok(await evaluate('[...document.querySelectorAll(".search-result")].some(e=>e.getAttribute("href").includes("parameters"))'))
  assert.deepEqual(failures,[], 'Browser JS / CSP errors')
  assert.ok(requests.every(url=>url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')), 'Unexpected remote request')
  const summary = { status:'passed', guides:guides.length, viewports:[390,1536], scenarios:['four hardware presets','RK MPP','app ARM64','MySQL required fields','literal password','invalid port','clipboard','download bytes','reset','independent node','no configuration persistence','parameter search','CSP','no external requests'], screenshots:report }
  await writeFile(join(report,'report.json'),JSON.stringify(summary,null,2)+'\n')
  console.log(JSON.stringify(summary,null,2))
} finally {
  socket?.close(); chrome.kill('SIGTERM'); await new Promise(resolve=>server.close(resolve))
}
