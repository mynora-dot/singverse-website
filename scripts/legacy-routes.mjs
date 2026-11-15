import { copyFileSync, mkdirSync } from 'node:fs'

// Starlight normalizes docs/index to /docs even with build.format = 'file'.
// Retain the original file URL too, including all fragment identifiers.
// Run after Pagefind so the alias does not create duplicate search results.
mkdirSync('dist/docs', { recursive: true })
copyFileSync('dist/docs.html', 'dist/docs/index.html')
