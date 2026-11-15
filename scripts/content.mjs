import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'

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
const pages = files.filter(file => file.endsWith('.html'))
const ids = new Map()
const anchors = JSON.parse(readFileSync('scripts/legacy-anchors.json', 'utf8'))
let links = 0
let sections = 0
let codeBlocks = 0
for (const file of pages) {
  const html = readFileSync(file, 'utf8')
  const found = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => decode(match[1]))
  assert.equal(new Set(found).size, found.length, relative(root, file) + ': duplicate IDs')
  ids.set(file, new Set(found))
  assert.equal((html.match(/<h1\b/g) || []).length, 1, file + ': expected one H1')
  assert.match(html, /<title>[^<]+<\/title>/, file + ': missing title')
  assert.match(html, /<meta\s+name="description"\s+content="[^"]+"/, file + ': missing description')
  assert.doesNotMatch(html, /\{\{root\}\}|<!-- partial:/, file + ': unresolved legacy template')
}
for (const [path, expected] of Object.entries(anchors)) {
  const file = resolve(root, path)
  assert.ok(ids.has(file), 'Legacy URL disappeared: ' + path)
  for (const id of expected) {
    assert.ok(ids.get(file).has(id), path + ': legacy section disappeared: #' + id)
    sections++
  }
  assert.match(readFileSync(file, 'utf8'), /<time datetime="\d{4}-\d{2}-\d{2}">/, path + ': missing verification date')
  const markdown = readFileSync('src/content/' + path.replace(/\.html$/, '.md'), 'utf8')
  const expectedCode = [...markdown.matchAll(/^(`{3,})[^\n]*\n([\s\S]*?)\n\1$/gm)].map(match => match[2])
  const copiedCode = [...readFileSync(file, 'utf8').matchAll(/\bdata-code="([^"]*)"/g)].map(match => decode(match[1]).replace(/\u007f/g, '\n'))
  assert.deepEqual(copiedCode, expectedCode, path + ': copied code differs from Markdown source')
  codeBlocks += expectedCode.length
}
for (const file of pages) {
  for (const match of readFileSync(file, 'utf8').matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const value = decode(match[1])
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(value)) continue
    assert.ok(!value.startsWith('//'), file + ': unexpected remote asset/link')
    const url = new URL(value, 'https://static.invalid/' + relative(root, file))
    const path = decodeURIComponent(url.pathname)
    const choices = [resolve(root, '.' + path), resolve(root, '.' + path + '.html'), resolve(root, '.' + path, 'index.html')]
    const target = choices.find(candidate => files.includes(candidate))
    assert.ok(target, relative(root, file) + ': missing ' + value)
    if (target.endsWith('.html') && url.hash) {
      assert.ok(ids.get(target)?.has(decodeURIComponent(url.hash.slice(1))), relative(root, file) + ': missing anchor ' + value)
    }
    links++
  }
}
assert.ok(existsSync(resolve(root, 'pagefind/pagefind.js')), 'Missing static Pagefind search index')
for (const path of files) {
  assert.doesNotMatch(relative(root, path), /(^|\/)(?:\.env(?:\.[^/]+)?|\.git|node_modules|src|package-lock\.json)(?:\/|$)/, 'Source or secret in public output')
  assert.ok(!path.endsWith('.map'), 'Source map in public output: ' + path)
}
assert.equal(readdirSync('src/content/docs').filter(file => file.endsWith('.md')).length, Object.keys(anchors).length)
console.log('Content checks passed:', { pages: pages.length, guides: Object.keys(anchors).length, preservedSections: sections, codeBlocks, localLinks: links })
