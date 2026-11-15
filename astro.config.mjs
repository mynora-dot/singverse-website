import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import { unified } from '@astrojs/markdown-remark'
import { legacyHeadingIds } from './scripts/legacy-heading-ids.mjs'

export default defineConfig({
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
  server: { host: '127.0.0.1', port: 5174 },
  markdown: { processor: unified({ remarkPlugins: [legacyHeadingIds], smartypants: false }) },
  integrations: [starlight({
    title: 'SingVerse',
    disable404Route: true,
    defaultLocale: 'root',
    locales: { root: { label: '简体中文', lang: 'zh-CN' } },
    favicon: '/assets/brand/favicon.ico',
    customCss: ['./src/styles/docs.css'],
    components: {
      Header: './src/components/DocsHeader.astro',
      PageTitle: './src/components/DocsPageTitle.astro',
      ThemeProvider: './src/components/LightTheme.astro',
    },
    sidebar: [
      { label: '入门', items: ['docs/index', 'docs/getting-started'] },
      { label: '曲库与整理', items: ['docs/library', 'docs/filename', 'docs/metadata', 'docs/audio', 'docs/resources'] },
      { label: '家庭开唱', items: ['docs/collections', 'docs/tv', 'docs/mobile', 'docs/party', 'docs/activity'] },
      { label: '系统管理', items: ['docs/tasks', 'docs/compute', 'docs/advanced', 'docs/security', 'docs/operations'] },
      { label: '帮助', items: ['docs/faq', { label: '客户端下载', link: '/download.html' }] },
    ],
    pagination: true,
    expressiveCode: {
      themes: ['github-light'],
      frames: { extractFileNameFromCode: false, removeCommentsWhenCopyingTerminalFrames: false },
    },
  })],
})
