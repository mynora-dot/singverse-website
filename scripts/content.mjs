import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve, extname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function decode(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? match
    const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match
  })
}

function plain(html) {
  return decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function attr(html, name) {
  return html.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || ''
}

export function contentFiles() {
  return ['index.html', 'download.html', ...readdirSync(resolve(websiteRoot, 'docs')).filter(file => file.endsWith('.html')).sort().map(file => `docs/${file}`)]
}

export function expandedHtml(file) {
  const root = file.startsWith('docs/') ? '..' : '.'
  let html = readFileSync(resolve(websiteRoot, file), 'utf8')
  html = html.replace(/<!-- partial:([\w-]+) -->/g, (_, name) => readFileSync(resolve(websiteRoot, 'src/partials', `${name}.html`), 'utf8'))
  return html.replaceAll('{{root}}', root)
}

// Search follows the actual document sections, so new guides and edits cannot leave
// a separate hand-maintained list of old feature descriptions behind.
export function createSearchIndex() {
  const entries = []
  for (const file of contentFiles().filter(file => file !== 'index.html')) {
    const html = readFileSync(resolve(websiteRoot, file), 'utf8')
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || ''
    const title = plain(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')
    const group = attr(html, 'data-docs-group') || '产品'
    const description = decode(html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] || '')
    const priority = { 'docs/index.html': 10, 'docs/getting-started.html': 9, 'docs/library.html': 8, 'docs/tv.html': 8, 'docs/mobile.html': 7, 'docs/party.html': 7 }
    entries.push({ group, title, url: file, keywords: `${title} ${description}`, excerpt: description, priority: priority[file] || 6 })
    const headings = [...main.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi)]
    headings.forEach((heading, i) => {
      const id = attr(heading[1], 'id')
      if (!id) return
      const section = main.slice(heading.index + heading[0].length, headings[i + 1]?.index ?? main.length).split('<nav class="docs-pager"')[0]
      const text = plain(section)
      const firstParagraph = plain(section.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || section)
      const excerpt = firstParagraph.slice(0, 150) + (firstParagraph.length > 150 ? '…' : '')
      entries.push({ group, title: plain(heading[2]), url: `${file}#${id}`, keywords: `${title} ${text}`, excerpt })
    })
  }
  entries.push(
    { group: '产品', title: '产品功能', url: 'index.html#product', keywords: '功能 曲库 原唱 伴奏 亲友 公平 电视 手机', excerpt: '家庭曲库、原伴切换与亲友扫码点歌。', priority: 4 },
    { group: '产品', title: '使用流程', url: 'index.html#workflow', keywords: '流程 部署 导入 安装 首次 开始', excerpt: '部署 NAS、整理曲库、电视开唱，手机和亲友加入。', priority: 4 },
    { group: '产品', title: '每一端的用途', url: 'index.html#capabilities', keywords: '对比 电视 手机 亲友 录音 轮唱 任务 能力', excerpt: '了解各端用途，找到对应操作指南。', priority: 3 },
  )
  return entries
}

export function checkContent() {
  const files = contentFiles()
  const ids = new Map()
  const errors = []
  let links = 0
  let sections = 0
  for (const file of files) {
    const html = expandedHtml(file)
    const found = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
    if (new Set(found).size !== found.length) errors.push(`${file}: duplicate element IDs`)
    ids.set(resolve(websiteRoot, file), new Set(found))
    if ((html.match(/<h1\b/g) || []).length !== 1) errors.push(`${file}: expected exactly one h1`)
    if (/\{\{root\}\}|<!-- partial:/.test(html)) errors.push(`${file}: unresolved template`)
    if (!/<meta name="description" content="[^"<>]+">/.test(html)) errors.push(`${file}: missing or invalid description`)
    if (file.startsWith('docs/')) {
      sections += (html.match(/<h2\b/g) || []).length
      if (!/<time datetime="\d{4}-\d{2}-\d{2}">/.test(html)) errors.push(`${file}: missing content verification date`)
      for (const heading of html.matchAll(/<h2\b([^>]*)>/g)) {
        if (!attr(heading[1], 'id')) errors.push(`${file}: h2 needs an anchor ID`)
      }
      if (!html.includes(`data-docs-link="${file.slice(5, -5)}"`)) errors.push(`${file}: missing sidebar entry`)
    }
  }
  for (const file of files) {
    for (const match of expandedHtml(file).matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const value = decode(match[1])
      if (/^(?:https?:|mailto:|tel:|data:)/i.test(value)) continue
      links++
      const url = new URL(value, pathToFileURL(resolve(websiteRoot, file)))
      const target = fileURLToPath(url)
      const publicTarget = resolve(websiteRoot, 'public', relative(websiteRoot, target))
      if (!existsSync(target) && !existsSync(publicTarget)) errors.push(`${file}: missing ${value}`)
      else if (extname(target) === '.html' && url.hash && !ids.get(target)?.has(decodeURIComponent(url.hash.slice(1)))) errors.push(`${file}: missing anchor ${value}`)
    }
  }
  const searchIndex = createSearchIndex()
  for (const entry of searchIndex) {
    const [file, anchor] = entry.url.split('#')
    if (!files.includes(file) || (anchor && !ids.get(resolve(websiteRoot, file))?.has(anchor))) errors.push(`Search: missing target ${entry.url}`)
  }
  if (errors.length) throw new Error(errors.join('\n'))
  return { pages: files.length, guides: files.filter(file => file.startsWith('docs/')).length, sections, localLinks: links, searchEntries: searchIndex.length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('Content checks passed:', checkContent())
}
