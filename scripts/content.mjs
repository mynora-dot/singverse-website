import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { parameterGroups } from '../src/lib/deployment/parameters.mjs'
const root = resolve('dist')
function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(dir, entry.name)
    return entry.isDirectory() ? filesUnder(file) : [file]
  })
}
function decode(text) {
  return text.replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}
const files = filesUnder(root)
const filePaths = new Set(files)
const pages = new Map(
  files.filter(file => file.endsWith('.html')).map(file => [file, readFileSync(file, 'utf8')])
)
const ids = new Map()
let links = 0
let codeBlocks = 0
for (const [file, html] of pages) {
  const found = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => decode(match[1]))
  assert.equal(new Set(found).size, found.length, relative(root, file) + ': duplicate IDs: ' + found.filter((id, index) => found.indexOf(id) !== index).join(', '))
  ids.set(file, new Set(found))
  assert.equal((html.match(/<h1\b/g) || []).length, 1, file + ': expected one H1')
  assert.match(html, /<title>[^<]+<\/title>/, file + ': missing title')
  assert.match(html, /<meta\s+name="description"\s+content="[^"]+"/, file + ': missing description')
  assert.doesNotMatch(html, /\{\{root\}\}|<!-- partial:/, file + ': unresolved template')
}
const guides = readdirSync('src/content/docs').filter(file => /\.mdx?$/.test(file))
for (const guide of guides) {
  const markdown = readFileSync('src/content/docs/' + guide, 'utf8')
  const slug = markdown.match(/^slug: "([^"]+)"$/m)?.[1]
  const verifiedAt = markdown.match(/^verifiedAt: "(\d{4}-\d{2}-\d{2})"$/m)?.[1]
  assert.ok(slug, guide + ': missing explicit slug')
  assert.ok(verifiedAt, guide + ': missing verification date')
  const file = resolve(root, slug + '.html')
  const html = pages.get(file)
  assert.ok(html, guide + ': missing rendered guide')
  assert.ok(html.includes('<time datetime="' + verifiedAt + '">'), guide + ': verification date differs from source')
  const expectedCode = [...markdown.matchAll(/^(`{3,})[^\n]*\n([\s\S]*?)\n\1$/gm)].map(match => match[2])
  const copiedCode = [...html.matchAll(/\bdata-code="([^"]*)"/g)].map(match => decode(match[1]).replace(/\u007f/g, '\n'))
  assert.deepEqual(copiedCode, expectedCode, guide + ': copied code differs from source')
  codeBlocks += expectedCode.length
}
for (const [file, html] of pages) {
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const value = decode(match[1])
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(value)) continue
    assert.ok(!value.startsWith('//'), file + ': unexpected remote asset/link')
    const url = new URL(value, 'https://static.invalid/' + relative(root, file))
    const path = decodeURIComponent(url.pathname)
    const choices = [resolve(root, '.' + path), resolve(root, '.' + path + '.html'), resolve(root, '.' + path, 'index.html')]
    const target = choices.find(candidate => filePaths.has(candidate))
    assert.ok(target, relative(root, file) + ': missing ' + value)
    if (target.endsWith('.html') && url.hash) assert.ok(ids.get(target)?.has(decodeURIComponent(url.hash.slice(1))), relative(root, file) + ': missing anchor ' + value)
    links++
  }
}
const reference = decode(readFileSync(resolve(root, 'docs/parameters.html'), 'utf8'))
for (const group of parameterGroups) for (const item of group.items) {
  assert.ok(reference.includes(item.key) && reference.includes(item.description) && reference.includes(item.change), 'Incomplete parameter explanation: ' + item.key)
}
assert.ok(existsSync(resolve(root, 'pagefind/pagefind.js')), 'Missing Pagefind index')
for (const path of files) {
  assert.doesNotMatch(relative(root, path), /(^|\/)(?:\.env(?:\.[^/]+)?|\.git|node_modules|src|package-lock\.json)(?:\/|$)/, 'Source or secret in public output')
  assert.ok(!path.endsWith('.map'), 'Source map in public output: ' + path)
}
console.log('Content checks passed:', {
  pages: pages.size,
  guides: guides.length,
  parameterEntries: parameterGroups.reduce((count, group) => count + group.items.length, 0),
  codeBlocks,
  localLinks: links
})
