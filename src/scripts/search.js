const dialog = document.querySelector('[data-search-dialog]')
const input = dialog.querySelector('input')
const results = dialog.querySelector('.search-results')
let trigger
let indexPromise
let revision = 0
let timer
let active = -1

function message(text) {
  const p = document.createElement('p')
  p.className = 'search-empty'
  p.textContent = text
  results.replaceChildren(p)
}

function openSearch(button) {
  trigger = button || document.activeElement
  dialog.showModal()
  input.focus()
}

document.querySelectorAll('[data-search-open]').forEach(button => {
  button.addEventListener('click', () => openSearch(button))
})
document.querySelector('[data-search-input]')?.addEventListener('click', event => openSearch(event.currentTarget))
dialog.querySelector('.search-dialog-close').addEventListener('click', () => dialog.close())
dialog.addEventListener('close', () => trigger?.focus())
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (dialog.open) dialog.close()
    else openSearch()
  }
})

function selectResult(index) {
  const links = [...results.querySelectorAll('a')]
  if (!links.length) return
  active = (index + links.length) % links.length
  links.forEach((link, i) => link.classList.toggle('is-active', i === active))
  links[active]?.scrollIntoView({ block: 'nearest' })
}
input.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    selectResult(active + (event.key === 'ArrowDown' ? 1 : -1))
  } else if (event.key === 'Enter') {
    event.preventDefault()
    results.querySelectorAll('a')[Math.max(active, 0)]?.click()
  }
})

input.addEventListener('input', () => {
  clearTimeout(timer)
  const request = ++revision
  const query = input.value.trim()
  active = -1
  if (!query) return message('输入关键词搜索全部文档')
  message('正在搜索…')
  timer = setTimeout(async () => {
    try {
      // Starlight generates Pagefind's static index at build time, including Chinese segmentation.
      indexPromise ??= import(/* @vite-ignore */ '/pagefind/pagefind.js')
      const pagefind = await indexPromise
      const search = await pagefind.search(query)
      const matches = await Promise.all(search.results.slice(0, 12).map(result => result.data()))
      if (request !== revision) return
      if (!matches.length) return message('没有找到相关内容，试试“部署”“点歌”或“WebDAV”')
      const fragment = document.createDocumentFragment()
      for (const data of matches) {
        const url = new URL(data.url, location.href)
        if (url.origin !== location.origin) continue
        const link = document.createElement('a')
        link.className = 'search-result'
        link.href = url.pathname + url.hash
        const title = document.createElement('div')
        title.className = 'search-result-title'
        title.textContent = data.meta.title
        const excerpt = document.createElement('div')
        excerpt.className = 'search-result-excerpt'
        // Index text is rendered as text nodes, never executable result HTML.
        excerpt.textContent = data.excerpt.replace(/<[^>]*>/g, '')
        link.append(title, excerpt)
        fragment.appendChild(link)
      }
      results.replaceChildren(fragment)
      selectResult(0)
    } catch {
      if (request === revision) message('搜索暂不可用，请稍后再试，或使用文档目录')
      indexPromise = undefined
    }
  }, 150)
})
