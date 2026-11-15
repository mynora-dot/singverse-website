import { defineConfig } from 'vite'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSearchIndex, checkContent } from './scripts/content.mjs'

const rootDir = dirname(fileURLToPath(import.meta.url))

function documentSearch() {
  const moduleId = 'virtual:singverse-doc-search'
  const resolvedId = `\0${moduleId}`
  return {
    name: 'singverse-document-search',
    buildStart() {
      checkContent()
    },
    resolveId(id) {
      if (id === moduleId) return resolvedId
    },
    load(id) {
      if (id === resolvedId) return `export const searchIndex = ${JSON.stringify(createSearchIndex())}`
    },
    handleHotUpdate(ctx) {
      if (!ctx.file.endsWith('.html')) return
      const module = ctx.server.moduleGraph.getModuleById(resolvedId)
      if (module) ctx.server.moduleGraph.invalidateModule(module)
      ctx.server.ws.send({ type: 'full-reload' })
      return []
    },
  }
}

function htmlPartials() {
  return {
    name: 'singverse-html-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const file = ctx.filename || ctx.path || ''
        const rel = file.startsWith(rootDir) ? file.slice(rootDir.length + 1) : file.replace(/^\//, '')
        const root = rel.startsWith('docs/') ? '..' : '.'
        let out = html.replaceAll('{{root}}', root)
        for (const name of ['header', 'footer', 'docs-sidebar']) {
          const marker = `<!-- partial:${name} -->`
          if (!out.includes(marker)) continue
          const partial = readFileSync(resolve(rootDir, 'src/partials', `${name}.html`), 'utf8').replaceAll('{{root}}', root)
          out = out.replaceAll(marker, partial)
        }
        return out
      },
    },
  }
}

const docInputs = Object.fromEntries(
  readdirSync(resolve(rootDir, 'docs'))
    .filter((file) => file.endsWith('.html'))
    .map((file) => [`docs-${file.replace(/\.html$/, '')}`, resolve(rootDir, 'docs', file)]),
)

export default defineConfig({
  base: './',
  plugins: [htmlPartials(), documentSearch()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        download: resolve(rootDir, 'download.html'),
        ...docInputs,
      },
    },
  },
})
