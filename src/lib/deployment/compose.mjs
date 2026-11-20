export const presets = [
  { id: 'a3000', name: 'NVIDIA · A3000', detail: 'AMD64 · NVENC 视频 / CUDA 音频', variant: 'cuda', arch: 'amd64', backend: 'nvenc', appMemory: 2048, computeMemory: 6144, audioMemory: 4096, processMemory: 1024, threads: 4, computeCpus: 4, songCache: 20, computeCache: 10, port: 18080, project: 'singverse-go-app' },
  { id: 'amd780m', name: 'AMD · Radeon 780M', detail: 'AMD64 · VAAPI 视频 / ROCm 音频', variant: 'rocm', arch: 'amd64', backend: 'vaapi', appMemory: 2048, computeMemory: 6144, audioMemory: 4096, processMemory: 1024, threads: 4, computeCpus: 4, songCache: 20, computeCache: 10, port: 18080, project: 'singverse-go-app' },
  { id: 'intel', name: 'Intel · N100 / 核显', detail: 'AMD64 · QSV 视频 / OpenVINO 音频', variant: 'openvino', arch: 'amd64', backend: 'qsv', appMemory: 1024, computeMemory: 4096, audioMemory: 2048, processMemory: 1024, threads: 2, computeCpus: 2, songCache: 20, computeCache: 5, port: 18080, project: 'singverse-go-app' },
  { id: 'rk3566', name: 'Rockchip · RK3566', detail: 'ARM64 · RKNN 音频 / 可选 MPP 视频', variant: 'rknn', arch: 'arm64', backend: 'auto', appMemory: 768, computeMemory: 2048, audioMemory: 1280, processMemory: 512, threads: 2, computeCpus: 2, songCache: 4, computeCache: 2, port: 18081, project: 'singverse-rk3566-test' },
]
export function defaults(hardware = 'a3000') {
  const preset = presets.find(item => item.id === hardware)
  if (!preset) throw new Error('请选择已支持的硬件预设。')
  return { ...preset, hardware, mode: 'stack', imagePrefix: 'docker.io/mynora', appVersion: 'latest', computeVersion: 'latest', bind: '0.0.0.0', nodePort: 18090,
    timezone: 'Asia/Shanghai', dataRoot: '.', mediaPath: '', appCpus: 2, shm: hardware === 'rk3566' ? 128 : 512,
    freeGiB: 2, concurrency: 1, workerIdle: 60, gpuId: '0', renderDevice: '/dev/dri/renderD128', mpp: false,
    rknnCard: '/dev/dri/card0', rknnRender: '/dev/dri/renderD128', rknnLibrary: '/usr/lib/librknnrt.so', deviceTree: '/sys/firmware/devicetree/base',
    database: 'sqlite', mysqlHost: '', mysqlPort: 3306, mysqlDatabase: 'singverse', mysqlUser: 'singverse', mysqlPassword: '',
    publicOrigin: '', trustedProxies: '' }
}
const MiB = 1024 ** 2
const GiB = 1024 ** 3
const isText = value => typeof value === 'string' && !/[\x00-\x1f\x7f]/.test(value)
const hostPath = value => isText(value) && (value === '.' || value.startsWith('./') || value.startsWith('/')) && !value.includes(':')
const devicePath = value => isText(value) && /^\/dev\/[a-zA-Z0-9_./-]+$/.test(value) && !value.split('/').includes('..')
const ipv4 = value => /^\d{1,3}(\.\d{1,3}){3}$/.test(value) && value.split('.').every(part => Number(part) <= 255)
function proxy(value) {
  const [address, mask, extra] = value.split('/')
  if (extra !== undefined) return false
  const v4 = ipv4(address)
  let v6 = false
  try { v6 = address.includes(':') && new URL(`http://[${address}]/`).hostname.length > 0 } catch { /* invalid IPv6 */ }
  return (v4 || v6) && (mask === undefined || /^\d+$/.test(mask) && Number(mask) >= 1 && Number(mask) <= (v4 ? 32 : 128))
}
export function validate(config) {
  const c = config
  const errors = []
  const add = (condition, field, message) => { if (!condition) errors.push({ field, message }) }
  const number = (field, min, max, label, integer = true) => add(c[field] !== '' && Number.isFinite(Number(c[field])) && (!integer || Number.isInteger(Number(c[field]))) && Number(c[field]) >= min && Number(c[field]) <= max, field, `${label}须为 ${min}–${max} 范围内的${integer ? '整数' : '数字'}。`)
  const hasApp = c.mode !== 'node'
  const hasCompute = c.mode !== 'app'
  add(['stack', 'app', 'node'].includes(c.mode), 'mode', '请选择有效的部署方式。')
  add(presets.some(p => p.id === c.hardware), 'hardware', '请选择已支持的硬件预设。')
  add(/^[a-z0-9][a-z0-9_-]{0,62}$/.test(c.project), 'project', '项目名须以小写字母或数字开头，仅含小写字母、数字、短横线和下划线。')
  add(['amd64', 'arm64'].includes(c.arch), 'arch', '管理端架构应为 amd64 或 arm64。')
  add(isText(c.imagePrefix) && /^(?:[a-z0-9]+(?:[.-][a-z0-9]+)*(?::[0-9]+)?\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/.test(c.imagePrefix), 'imagePrefix', '镜像前缀请填仓库域名和空间，例如 docker.io/mynora；不含协议或末尾斜杠。')
  for (const key of [hasApp && 'appVersion', hasCompute && 'computeVersion'].filter(Boolean)) add(/^[\w][\w.-]{0,100}$/.test(c[key]), key, '版本须为有效 Docker 标签，如 latest 或已发布的 1.2.3；计算版本不带运行库后缀。')
  add(ipv4(c.bind), 'bind', '宿主监听地址请填 IPv4，如 0.0.0.0、127.0.0.1 或实际局域网 IP。')
  add(hostPath(c.dataRoot) && !c.dataRoot.split('/').includes('..'), 'dataRoot', '数据根目录须为 .、./目录 或 Linux 绝对目录，不包含冒号或 ..。')
  try { new Intl.DateTimeFormat('zh-CN', { timeZone: c.timezone }).format(); add(Boolean(c.timezone), 'timezone', '请填写时区。') } catch { errors.push({ field: 'timezone', message: '请填写有效 IANA 时区，例如 Asia/Shanghai。' }) }
  if (hasApp) {
    number('port', 1, 65535, '管理端口'); number('appMemory', 256, 1048576, '管理端内存 MiB'); number('appCpus', 0.1, 256, '管理端 CPU', false)
    number('songCache', 0, 1048576, '播放缓存 GiB', false)
    add(!c.mediaPath || hostPath(c.mediaPath), 'mediaPath', '曲库目录须为 ./目录 或 Linux 绝对目录，不包含冒号或换行。')
    add(['sqlite', 'mysql'].includes(c.database), 'database', '请选择 SQLite 或已有 MySQL。')
    if (c.publicOrigin) {
      let valid = false
      try { const url = new URL(c.publicOrigin); valid = url.protocol === 'https:' && !url.username && !url.password && url.origin === c.publicOrigin } catch { /* invalid URL */ }
      add(valid, 'publicOrigin', 'HTTPS 来源须为 https://域名[:端口]，不含末尾斜杠、路径或凭据。')
      add(Boolean(c.trustedProxies.trim()), 'trustedProxies', '使用 HTTPS 代理时请填写 Go 实际看到的可信代理 IP/CIDR。')
    }
    add(!c.trustedProxies || c.trustedProxies.split(',').every(value => proxy(value.trim())), 'trustedProxies', '代理须为逗号分隔的 IP/CIDR，不允许任意地址的 /0。')
    if (c.database === 'mysql') {
      add(isText(c.mysqlHost) && /^[a-zA-Z0-9.-]+$/.test(c.mysqlHost), 'mysqlHost', '填写容器可达的 MySQL IPv4 或主机名，不带协议和端口。')
      number('mysqlPort', 1, 65535, 'MySQL 端口')
      for (const [field, label] of [['mysqlDatabase', '数据库名'], ['mysqlUser', '数据库账号'], ['mysqlPassword', '数据库密码']]) add(isText(c[field]) && c[field].length > 0, field, `请填写${label}，不能包含控制字符。`)
    }
  }
  number('freeGiB', 0, 1048576, '磁盘最低余量 GiB', false)
  if (hasCompute) {
    if (c.mode === 'node') number('nodePort', 1, 65535, '独立节点端口')
    number('computeMemory', 1024, 1048576, '计算端内存 MiB'); number('computeCpus', 0.1, 256, '计算端 CPU', false)
    number('processMemory', 64, 1048576, '媒体进程内存 MiB'); number('audioMemory', 512, 1048576, '音频进程内存 MiB')
    number('computeCache', 0.1, 1048576, '计算缓存 GiB', false); number('concurrency', 1, 16, '视频并发')
    number('threads', 0, 8, '音频线程'); number('workerIdle', 0, 3600, '空闲回收秒数'); number('shm', 64, 1048576, '共享内存 MiB')
    add(Number(c.computeMemory) >= Number(c.processMemory) * Number(c.concurrency) + Number(c.audioMemory) + 256, 'computeMemory', '计算容器限额应覆盖媒体预算 × 并发、音频预算，并至少为服务保留 256 MiB。')
    add(Number(c.shm) < Number(c.computeMemory), 'shm', '共享内存上限应小于计算容器内存限额。')
    if (['amd780m', 'intel'].includes(c.hardware)) add(/^\/dev\/dri\/renderD[0-9]+$/.test(c.renderDevice), 'renderDevice', '填写真实 render 节点，例如 /dev/dri/renderD128。')
    if (c.hardware === 'a3000') add(/^(?:[0-9]+|GPU-[a-zA-Z0-9-]+)$/.test(c.gpuId), 'gpuId', '填写宿主 NVIDIA GPU 编号或 GPU- 开头的 UUID。')
    if (c.hardware === 'amd780m') add(/^[0-9]+$/.test(c.gpuId), 'gpuId', '填写 ROCm 枚举中的 GPU 数字序号。')
    if (c.hardware === 'rk3566') {
      for (const field of ['rknnCard', 'rknnRender']) add(devicePath(c[field]), field, 'RKNN 设备须填写 /dev/ 下真实节点。')
      for (const field of ['rknnLibrary', 'deviceTree']) add(hostPath(c[field]) && c[field].startsWith('/'), field, 'RKNN 运行库和设备树须填写宿主绝对路径。')
    }
  }
  return errors
}
function envDefaults(entries) { return Object.fromEntries(entries) }
function mounts(root) {
  const prefix = root.replace(/\/+$/, '') || ''
  return name => `${prefix}/singverse-${name}`
}
function sharedService(memory, cpus) {
  return { user: '0:0', mem_limit: `${Number(memory)}m`, cpus: Number(cpus), restart: 'unless-stopped', logging: { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '3' } } }
}
function health(test) { return { test, interval: '5s', timeout: '3s', start_period: '30s', retries: 6 } }
export function buildCompose(c) {
  const errors = validate(c)
  if (errors.length) throw new Error(errors.map(error => error.message).join('\n'))
  const p = presets.find(item => item.id === c.hardware)
  const folder = mounts(c.dataRoot)
  const result = { name: c.project, services: {} }
  const bytes = (value, unit) => String(Math.round(Number(value) * unit))
  const hasCompute = c.mode !== 'app'
  if (c.mode !== 'node') {
    const environment = envDefaults([
      ['TZ', c.timezone], ['SINGVERSE_DB_DRIVER', c.database], ['SINGVERSE_BIND_ADDRESS', '0.0.0.0'], ['SERVER_PORT', '8080'],
      ['SQLITE_PATH', '/data/singverse.db'], ['SINGVERSE_AUTH_KEY_FILE', '/secrets/master.key'], ['DBMATE_BIN', '/usr/local/bin/dbmate'], ['SINGVERSE_MIGRATIONS_DIR', '/opt/singverse/database/migrations'],
      ['COMPUTE_NODE_URL', hasCompute ? 'http://singverse-compute:8090' : ''], ['COMPUTE_AUTH_TOKEN_FILE', '/run/singverse-compute/token'],
      ['SINGVERSE_COMPUTE_AUTO_CALLBACK_ORIGIN', hasCompute ? 'http://singverse-go-backend:8080' : ''], ['SINGVERSE_CALLBACK_ORIGIN', hasCompute ? 'http://singverse-go-backend:8080' : ''],
      ['SINGVERSE_PUBLIC_ORIGIN', c.publicOrigin], ['SINGVERSE_TRUSTED_PROXIES', c.trustedProxies],
      ['WEBDAV_METADATA_PATH', '/data/metadata/webdav'], ['METADATA_CACHE_PATH', '/data/metadata/covers'], ['TRANSCODE_VERSION_PATH', '/data/transcoding'],
      ['SINGVERSE_SONG_CACHE_PATH', '/data/transcoding/cache'], ['SINGVERSE_SONG_CACHE_BYTES', bytes(c.songCache, GiB)], ['SINGVERSE_SONG_CACHE_MINIMUM_FREE_BYTES', bytes(c.freeGiB, GiB)],
      ['AUDIO_DERIVED_PATH', '/data/audio-roles'], ['SINGVERSE_CLIENT_RELEASE_DIRECTORY', '/opt/singverse/releases'], ['SINGVERSE_TV_RELEASE_DIRECTORY', ''],
      ['SINGVERSE_TV_DISCOVERY_ADDRESS', ''], ['SINGVERSE_TV_DISCOVERY_PORT', String(c.port)], ['SINGVERSE_DIAGNOSTICS_ADDRESS', ''],
    ])
    if (c.database === 'mysql') Object.assign(environment, { MYSQL_HOST: c.mysqlHost, MYSQL_PORT: String(c.mysqlPort), MYSQL_DATABASE: c.mysqlDatabase, MYSQL_USER: c.mysqlUser, MYSQL_PASSWORD: c.mysqlPassword })
    result.services['singverse-go-backend'] = {
      image: `${c.imagePrefix}/singverse:${c.appVersion}`, platform: `linux/${hasCompute ? p.arch : c.arch}`, ...sharedService(c.appMemory, c.appCpus), environment,
      ports: [{ target: 8080, published: String(c.port), host_ip: c.bind, protocol: 'tcp' }],
      volumes: [`${folder('data')}:/data`, `${folder('secrets')}:/secrets`, `${folder('compute-auth')}:/run/singverse-compute:ro`,
        ...(c.mediaPath ? [{ type: 'bind', source: c.mediaPath, target: '/media', read_only: true, bind: { create_host_path: false } }] : [`${folder('media')}:/media:ro`]), `${folder('downloads')}:/downloads`],
      healthcheck: health(['CMD', 'wget', '--quiet', '--spider', 'http://127.0.0.1:8080/api/health']), stop_grace_period: '25s',
    }
  }
  if (hasCompute) {
    const environment = envDefaults([
      ['TZ', c.timezone], ['SINGVERSE_COMPUTE_VARIANT', p.variant], ['COMPUTE_AUTH_TOKEN_FILE', '/run/singverse-compute/token'], ['COMPUTE_LAN_PAIRING_ENABLED', c.mode === 'node' ? 'true' : 'false'],
      ['COMPUTE_TRANSCODE_ROOT', '/var/cache/singverse-transcode'], ['COMPUTE_FFMPEG', '/usr/lib/jellyfin-ffmpeg/ffmpeg'], ['COMPUTE_FFPROBE', '/usr/lib/jellyfin-ffmpeg/ffprobe'],
      ['COMPUTE_HARDWARE_BACKEND', c.hardware === 'rk3566' && c.mpp ? 'rkmpp' : p.backend], ['COMPUTE_HARDWARE_DEVICE', ['amd780m', 'intel'].includes(c.hardware) ? c.renderDevice : ''],
      ['COMPUTE_PROCESS_MEMORY_BYTES', bytes(c.processMemory, MiB)], ['COMPUTE_TRANSCODE_CONCURRENCY', String(c.concurrency)], ['COMPUTE_CACHE_BYTES', bytes(c.computeCache, GiB)], ['COMPUTE_MINIMUM_FREE_BYTES', bytes(c.freeGiB, GiB)],
      ['COMPUTE_AUDIO_MODEL_REPO', '/var/lib/singverse-models/htdemucs'], ['COMPUTE_AUDIO_MEMORY_BYTES', bytes(c.audioMemory, MiB)], ['COMPUTE_AUDIO_THREADS', String(c.threads)], ['COMPUTE_AUDIO_WORKER_IDLE_SECONDS', String(c.workerIdle)],
      ['COMPUTE_AUDIO_CPU_PYTHON', '/opt/singverse-audio-cpu/bin/python'], ['COMPUTE_AUDIO_ACCELERATOR_PYTHON', p.variant === 'cuda' ? '/opt/singverse-audio-accelerator/bin/python' : '/usr/local/bin/python'],
    ])
    const service = {
      image: `${c.imagePrefix}/singverse-compute:${c.computeVersion}-${p.variant}`, platform: `linux/${p.arch}`, ...sharedService(c.computeMemory, c.computeCpus), init: true,
      command: ['python', '-m', 'singverse_compute', '--host', '0.0.0.0', '--port', '8090'], environment,
      volumes: [`${folder('compute-auth')}:/run/singverse-compute`, `${folder('transcode-cache')}:/var/cache/singverse-transcode`, `${folder('audio-models')}:/var/lib/singverse-models`],
      shm_size: `${Number(c.shm)}m`, healthcheck: health(['CMD', 'python', '-c', "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8090/health', timeout=2)"]), stop_grace_period: '20s',
    }
    if (c.mode === 'node') service.ports = [{ target: 8090, published: String(c.nodePort), host_ip: c.bind, protocol: 'tcp' }]
    if (c.hardware === 'a3000') {
      Object.assign(environment, { NVIDIA_DRIVER_CAPABILITIES: 'compute,video,utility', CUDA_VISIBLE_DEVICES: '0' })
      service.deploy = { resources: { reservations: { devices: [{ driver: 'nvidia', device_ids: [c.gpuId], capabilities: ['gpu'] }] } } }
    }
    if (['amd780m', 'intel'].includes(c.hardware)) service.devices = ['/dev/dri:/dev/dri']
    if (c.hardware === 'amd780m') {
      Object.assign(environment, { HOME: '/tmp', USER: 'singverse', LOGNAME: 'singverse', HIP_VISIBLE_DEVICES: c.gpuId, LIBVA_DRIVER_NAME: 'radeonsi' })
      service.devices.unshift('/dev/kfd:/dev/kfd')
      service.ulimits = { memlock: { soft: -1, hard: -1 } }
    }
    if (c.hardware === 'rk3566') {
      service.devices = [`${c.rknnCard}:/dev/dri/card0`, `${c.rknnRender}:/dev/dri/renderD128`, `${c.rknnRender}:/dev/dri/renderD129`]
      if (c.mpp) service.devices.push('/dev/mpp_service:/dev/mpp_service', '/dev/rga:/dev/rga', '/dev/dma_heap:/dev/dma_heap')
      const bind = (source, target) => ({ type: 'bind', source, target, read_only: true, bind: { create_host_path: false } })
      service.volumes.push(bind(c.rknnLibrary, '/usr/lib/librknnrt.so'), bind(c.deviceTree, '/run/singverse-hardware/device-tree'), bind(`${c.deviceTree.replace(/\/+$/, '')}/compatible`, '/proc/device-tree/compatible'))
    }
    result.services['singverse-compute'] = service
  }
  return result
}
// Emit a small YAML subset: every string is JSON-quoted (valid YAML); dollars
// are escaped for Compose interpolation, including passwords and bind paths.
const scalar = value => typeof value === 'string' ? JSON.stringify(value.replaceAll('$', () => '$$')) : String(value)
export function stringifyYaml(value, indent = 0) {
  const space = ' '.repeat(indent)
  if (Array.isArray(value)) return value.map(item => item !== null && typeof item === 'object' ? `${space}-\n${stringifyYaml(item, indent + 2)}` : `${space}- ${scalar(item)}`).join('\n')
  return Object.entries(value).map(([key, item]) => item !== null && typeof item === 'object' ? `${space}${key}:\n${stringifyYaml(item, indent + 2)}` : `${space}${key}: ${scalar(item)}`).join('\n')
}
export function notes(c) {
  const lines = ['配置使用容器 root 读写绑定目录，无需 chown；宿主新文件通常归 root。', '目录相对于此 YAML；迁移已有部署时保留项目名、数据库、主密钥和 token，不能同时启动两套服务写同一数据库。']
  if (c.mode !== 'node') lines.push(c.bind === '127.0.0.1' ? '当前只允许宿主本机访问。手机/电视访问需改为可达的局域网入口，或配置反向代理。' : `管理入口：http://<主机局域网 IP>:${c.port}/admin/；新数据库 admin/admin，登录后改密。`)
  if (c.mode === 'node') lines.push(`独立节点发布 ${c.nodePort} 端口；在管理端配对，回调填节点可达的业务地址。不要把 8090 当作管理页面。`)
  if (c.mode === 'app') lines.push('本文件仅部署管理端。媒体探测、兼容转码和音频模型任务需另外连接计算节点。')
  if (c.mode !== 'app') {
    lines.push('容器 healthy 只表示服务启动；需完成视频和音频模型试跑。模型不随镜像提供。')
    if (c.hardware === 'a3000') lines.push('宿主需要 NVIDIA 驱动及 Container Toolkit；先确认 nvidia-smi 可见目标 GPU。')
    if (c.hardware === 'amd780m') lines.push('确认 amdgpu、/dev/kfd 和 render 节点。Torch/ROCm 的 htdemucs 与 MDX/MIGraphX 不同；缺少 MIGraphX 时干净档只能按已验证的 CPU 降级策略执行。')
    if (c.hardware === 'intel') lines.push('确认 /dev/dri 与 Intel 驱动。QSV 视频通过不代表 OpenVINO 音频模型也已通过。')
    if (c.hardware === 'rk3566') lines.push('RK3566 必须核对 NPU card/render 节点、匹配的 librknnrt.so 与设备树。默认映射来自特定板端，不保证其他 BSP 路径相同。', 'RKNN 模型需为 rk3566 目标，包含 manifest.json 和 uvr.rknn；干净档还需基准 MDX ONNX 模型。', c.mpp ? '已启用 MPP：宿主必须存在 /dev/mpp_service、/dev/rga、/dev/dma_heap，随后执行 rkmpp 视频试跑。' : '默认未映射 MPP，视频 auto 按实际资格及 CPU 降级策略执行，NPU 不承担视频编码。')
  }
  if (c.database === 'mysql' && c.mode !== 'node') lines.push('使用已有 MySQL，未生成数据库容器。密码将出现在下载的 YAML 中；浏览器不保存或上传。')
  return lines
}
export function generate(c) {
  const body = stringifyYaml(buildCompose(c))
  return '# SingVerse 单文件部署 · 无需 .env\n# user: 0:0；相对目录绑定；镜像版本请核对实际发布。\n# 变更数据目录不会自动迁移原数据；硬件仍需在目标主机试跑。\n' + body + '\n'
}
