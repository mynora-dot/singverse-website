import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}
const scripts = new Set()
const styles = new Set()
const htmlFiles = filesUnder('dist').filter(path => path.endsWith('.html'))
if (!htmlFiles.length) throw new Error('Build the static site before generating security headers')
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
  for (const [tag, hashes] of [['script', scripts], ['style', styles]]) {
    for (const match of html.matchAll(new RegExp('<' + tag + '\\b([^>]*)>([\\s\\S]*?)</' + tag + '>', 'gi'))) {
      if (tag === 'script' && /\bsrc\s*=/.test(match[1])) continue
      if (match[2]) hashes.add("'sha256-" + createHash('sha256').update(match[2]).digest('base64') + "'")
    }
  }
  const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  if (/\son[a-z]+\s*=/i.test(markup) || /(?:href|src)=["']\s*javascript:/i.test(markup)) {
    throw new Error('Unsafe executable HTML attribute in ' + file)
  }
}
// Pagefind requires WebAssembly, but JavaScript eval remains blocked.
// Existing illustrations use inline style attributes; inline scripts require hashes.
const policy = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval' " + [...scripts].sort().join(' '),
  "script-src-attr 'none'",
  "style-src 'self' " + [...styles].sort().join(' '),
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ')
mkdirSync('.build', { recursive: true })
writeFileSync('.build/security-headers.conf', [
  '# Generated for this exact static build. Regenerate whenever HTML changes.',
  'add_header Content-Security-Policy "' + policy + '" always;',
  'add_header X-Content-Type-Options "nosniff" always;',
  'add_header X-Frame-Options "DENY" always;',
  'add_header Referrer-Policy "no-referrer" always;',
  'add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;',
  '',
].join('\n'))
writeFileSync('.build/security-report.json', JSON.stringify({ htmlFiles: htmlFiles.length, inlineScripts: scripts.size, inlineStyles: styles.size, policy }, null, 2) + '\n')
console.log('Security headers generated for ' + htmlFiles.length + ' pages; inline scripts protected by ' + scripts.size + ' hashes')
