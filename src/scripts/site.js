
const icons = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  tv: '<rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 21h8"/>',
  smartphone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15c3 0 5 1.8 5 4.5"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  'arrow-right': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M7 5v14l12-7z"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="2.5"/><path d="M4 5.5v13c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-13"/><path d="M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M19.1 4.9 17 7m-10 10-2.1 2.1"/>',
  download: '<path d="M12 4v11m-5-5 5 5 5-5"/><path d="M5 20h14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'qr-code': '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M20 20v.01M17 20h.01M20 17h.01"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  heart: '<path d="M12 20s-7-4.5-9-9c-1.2-2.8.5-6 3.5-6 2 0 3.5 1.2 5.5 3.5C14 6.2 15.5 5 17.5 5c3 0 4.7 3.2 3.5 6-2 4.5-9 9-9 9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 9v5m0 3v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="10" y="10" width="4" height="4"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4M18 9h4m-4 6h4"/>',
  'hard-drive': '<path d="M3 13h18v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M5 13 7 5h10l2 8"/><path d="M7 17h.01M11 17h.01"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3"/><path d="M4 4v4h4m12 12v-4h-4"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
  sliders: '<path d="M4 6h10m4 0h2M4 12h4m4 0h8M4 18h13m3 0h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="19" cy="18" r="2"/>',
  wifi: '<path d="M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10 10 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5v.01"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6m2.5-9a8 8 0 0 1 0 12"/>',
  skip: '<path d="M5 5v14l9-7z"/><path d="M18 5v14"/>',
  'external-link': '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
}

function icon(name) {
  const body = icons[name] || icons.info
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`
}

document.querySelectorAll('[data-icon]').forEach((el) => {
  el.innerHTML = icon(el.dataset.icon)
})

const path = location.pathname

function setActiveNav() {
  const isDocs = /^\/docs(?:\/|(?:\.html)?$)/.test(path)
  const isDownload = /\/download(?:\.html)?$/.test(path)
  const isHome = /^(?:\/|\/index(?:\.html)?)$/.test(path)
  const hash = location.hash
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const key = link.dataset.nav
    let active = false
    if (isDocs) active = key === 'docs'
    else if (isDownload) active = key === 'download'
    else if (isHome) active = key === (hash === '#workflow' ? 'workflow' : 'product')
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
}
setActiveNav()
window.addEventListener('hashchange', setActiveNav)

const menuToggle = document.querySelector('[data-menu-toggle]')
const mobileMenu = document.getElementById('mobile-menu')
function closeMenu() {
  if (!mobileMenu) return
  mobileMenu.hidden = true
  menuToggle?.setAttribute('aria-expanded', 'false')
  document.body.classList.remove('menu-open')
}
menuToggle?.addEventListener('click', () => {
  const open = mobileMenu.hidden
  mobileMenu.hidden = !open
  menuToggle.setAttribute('aria-expanded', String(open))
  document.body.classList.toggle('menu-open', open)
})
mobileMenu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu))
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu() })
window.addEventListener('resize', () => { if (window.innerWidth > 900) closeMenu() })

const deviceTabs = [...document.querySelectorAll('[data-device-tab]')]
const devicePanels = [...document.querySelectorAll('[data-device-panel]')]
function selectDevice(name) {
  deviceTabs.forEach((tab) => {
    const selected = tab.dataset.deviceTab === name
    tab.setAttribute('aria-selected', String(selected))
    tab.tabIndex = selected ? 0 : -1
  })
  devicePanels.forEach((panel) => {
    const selected = panel.dataset.devicePanel === name
    panel.hidden = !selected
    panel.classList.toggle('is-active', selected)
  })
}
deviceTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectDevice(tab.dataset.deviceTab))
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = event.key === 'ArrowRight' ? (index + 1) % deviceTabs.length : (index - 1 + deviceTabs.length) % deviceTabs.length
    deviceTabs[next].focus()
    selectDevice(deviceTabs[next].dataset.deviceTab)
  })
})
if (deviceTabs.length) selectDevice(deviceTabs[0].dataset.deviceTab)

let toastTimer
function showToast(message) {
  const toast = document.querySelector('[data-toast]')
  if (!toast) return
  toast.textContent = message
  toast.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.hidden = true }, 2400)
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {}
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  area.remove()
  return ok
}

const demoQueue = []
const demoList = document.querySelector('[data-demo-queue]')
const demoCount = document.querySelector('[data-demo-count]')
const demoAdd = document.querySelector('[data-demo-add]')
const demoReset = document.querySelector('[data-demo-reset]')
function renderDemoQueue() {
  if (!demoList) return
  demoList.innerHTML = demoQueue.length
    ? demoQueue.map((song, i) => `<div class="demo-queue-item"><span class="mono">${String(i + 1).padStart(2, '0')}</span><span>${song.title} · ${song.artist}</span></div>`).join('')
    : '<p class="demo-queue-empty">队列是空的，点一首试试</p>'
  if (demoCount) demoCount.textContent = String(demoQueue.length)
  if (demoAdd) demoAdd.disabled = demoQueue.length >= 5
}
demoAdd?.addEventListener('click', () => {
  if (demoQueue.length >= 5) return
  demoQueue.push({ title: '晴天', artist: '周杰伦' })
  renderDemoQueue()
  showToast('已加入待唱（演示）')
})
demoReset?.addEventListener('click', () => {
  demoQueue.length = 0
  renderDemoQueue()
  showToast('演示队列已清空')
})
renderDemoQueue()

const trackButtons = [...document.querySelectorAll('[data-track]')]
const waveform = document.querySelector('[data-waveform]')
const trackLabel = document.querySelector('[data-track-label]')
trackButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const track = button.dataset.track
    trackButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)))
    waveform?.classList.toggle('is-accompaniment', track === 'accompaniment')
    if (trackLabel) trackLabel.textContent = track === 'accompaniment' ? '伴奏' : '原唱'
  })
})

const downloadForm = document.querySelector('[data-download-form]')
if (downloadForm) {
  const input = downloadForm.querySelector('input')
  const error = downloadForm.querySelector('[data-download-error]')
  const warn = downloadForm.querySelector('[data-download-warn]')
  const result = document.querySelector('[data-download-result]')
  const link = document.querySelector('[data-download-link]')
  const open = document.querySelector('[data-download-open]')
  const copy = document.querySelector('[data-download-copy]')
  let currentUrl = ''
  downloadForm.addEventListener('submit', (event) => {
    event.preventDefault()
    error.hidden = true
    warn.hidden = true
    result.hidden = true
    currentUrl = ''
    let value = input.value.trim()
    if (!value) {
      error.textContent = '请输入 NAS 地址'
      error.hidden = false
      return
    }
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) {
      error.textContent = 'NAS 地址仅支持 HTTP 或 HTTPS'
      error.hidden = false
      return
    }
    if (!/^https?:\/\//i.test(value)) value = `http://${value}`
    let url
    try {
      url = new URL(value)
    } catch {
      error.textContent = '地址格式不正确，例如 http://192.168.1.100:18080'
      error.hidden = false
      return
    }
    if (!url.hostname) {
      error.textContent = '地址缺少主机名'
      error.hidden = false
      return
    }
    if (url.username || url.password) {
      error.textContent = '请填写 NAS 根地址，不要在地址中包含账号或密码'
      error.hidden = false
      return
    }
    currentUrl = `${url.origin}/downloads/`
    link.textContent = currentUrl
    open.href = currentUrl
    result.hidden = false
    const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)
    warn.hidden = !loopback
  })
  input.addEventListener('input', () => {
    error.hidden = true
    warn.hidden = true
    result.hidden = true
    currentUrl = ''
  })
  copy?.addEventListener('click', async () => {
    if (!currentUrl) return
    const ok = await copyText(currentUrl)
    showToast(ok ? '下载页地址已复制' : '复制失败，请手动选择地址')
  })
}

const revealItems = document.querySelectorAll('[data-reveal]')
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  revealItems.forEach((el) => el.classList.add('is-visible'))
} else {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        revealObserver.unobserve(entry.target)
      }
    })
  }, { threshold: 0.12 })
  revealItems.forEach((el) => revealObserver.observe(el))
}
