import assert from 'node:assert/strict'
import test from 'node:test'
import { defaults, presets, buildCompose, generate, validate } from '../src/lib/deployment/compose.mjs'
import { appParameters, computeParameters, mysqlParameters, runtimeParameters } from '../src/lib/deployment/parameters.mjs'
const allowed = new Set([...appParameters, ...computeParameters, ...mysqlParameters, ...runtimeParameters].map(p => p.key))
for (const p of presets) for (const mode of ['stack', 'app', 'node']) test(`${p.id}: ${mode} has complete parameters, persistent binds and matching hardware`, () => {
  const c = { ...defaults(p.id), mode }
  const output = buildCompose(c)
  assert.equal(Object.keys(output.services).length, mode === 'stack' ? 2 : 1)
  assert.equal(output.volumes, undefined)
  for (const service of Object.values(output.services)) {
    assert.equal(service.user, '0:0')
    assert.ok(service.volumes.every(mount => typeof mount === 'string' ? mount.startsWith('./') : mount.type === 'bind'))
    assert.ok(Object.entries(service.environment).every(([key, value]) => allowed.has(key) && typeof value === 'string'))
    assert.ok(!service.privileged && !service.security_opt && !service.env_file && !service.build)
  }
  const app = output.services['singverse-go-backend'], node = output.services['singverse-compute']
  if (app) {
    assert.ok(appParameters.every(p => Object.hasOwn(app.environment, p.key)))
    assert.equal(app.ports[0].published, String(c.port))
    assert.equal(app.environment.SINGVERSE_TV_DISCOVERY_PORT, String(c.port))
    assert.equal(app.environment.COMPUTE_NODE_URL, mode === 'stack' ? 'http://singverse-compute:8090' : '')
    assert.ok(!app.depends_on)
  }
  if (node) {
    assert.ok(computeParameters.every(p => Object.hasOwn(node.environment, p.key)))
    assert.equal(node.platform, 'linux/' + p.arch)
    assert.equal(node.environment.COMPUTE_LAN_PAIRING_ENABLED, mode === 'node' ? 'true' : 'false')
    assert.equal(node.ports?.[0]?.published, mode === 'node' ? '18090' : undefined)
    assert.equal(node.environment.COMPUTE_AUDIO_ACCELERATOR_PYTHON, p.variant === 'cuda' ? '/opt/singverse-audio-accelerator/bin/python' : '/usr/local/bin/python')
    if (p.id === 'a3000') assert.deepEqual(node.deploy.resources.reservations.devices[0].capabilities, ['gpu'])
    if (p.id === 'amd780m') assert.ok(node.devices.includes('/dev/kfd:/dev/kfd'))
    if (p.id === 'intel') assert.equal(node.environment.COMPUTE_HARDWARE_BACKEND, 'qsv')
    if (p.id === 'rk3566') {
      assert.ok(node.devices.includes('/dev/dri/renderD128:/dev/dri/renderD129'))
      assert.equal(node.volumes.filter(mount => mount.type === 'bind' && mount.read_only && !mount.bind.create_host_path).length, 3)
      assert.ok(!node.devices.some(device => device.includes('mpp')))
    }
  }
  assert.doesNotMatch(generate(c), /\$\{|chown |privileged:/)
})
test('MySQL requires explicit credentials and preserves literal special characters', () => {
  const c = { ...defaults(), database: 'mysql' }
  assert.ok(validate(c).some(e => e.field === 'mysqlPassword'))
  assert.throws(() => generate(c))
  Object.assign(c, { mysqlHost: 'db.internal', mysqlPassword: 'test-$HOME-${MISSING}-$$-"-\\-中文' })
  const app = buildCompose(c).services['singverse-go-backend']
  assert.equal(app.environment.MYSQL_PASSWORD, c.mysqlPassword)
  assert.match(generate(c), /\$\$HOME-\$\$\{MISSING\}-\$\$\$\$/)
})
test('rejects invalid ports, paths, origins, wildcard proxies, budgets and GPU identifiers', () => {
  for (const bad of [{ port: 0 }, { port: 65536 }, { port: '80\nservices:' }, { imagePrefix: 'https://docker.io/mynora' }, { dataRoot: '../production' }, { dataRoot: 'volume-name' }, { mediaPath: '/media\nname: injected' }, { publicOrigin: 'http://nas.example' }, { publicOrigin: 'https://nas.example/' }, { publicOrigin: 'https://nas.example', trustedProxies: '' }, { trustedProxies: '0.0.0.0/0' }, { trustedProxies: '::/0' }, { computeMemory: 1024 }, { concurrency: 17 }, { threads: 9 }, { gpuId: '0,1' }, { timezone: 'not/a-zone' }]) {
    assert.ok(validate({ ...defaults(), ...bad }).length > 0, JSON.stringify(bad))
  }
})
test('custom directories, independent versions, HTTPS and optional RK MPP remain coordinated', () => {
  const c = { ...defaults('rk3566'), mpp: true, dataRoot: '/srv/家庭 KTV', mediaPath: '/media/已有歌曲', port: 18123, appVersion: '1.2.3', computeVersion: '4.5.6', publicOrigin: 'https://sing.example.com', trustedProxies: '192.168.1.2,fd00::/64' }
  const config = buildCompose(c), app = config.services['singverse-go-backend'], node = config.services['singverse-compute']
  assert.equal(app.image, 'docker.io/mynora/singverse:1.2.3')
  assert.equal(node.image, 'docker.io/mynora/singverse-compute:4.5.6-rknn')
  assert.equal(node.environment.COMPUTE_HARDWARE_BACKEND, 'rkmpp')
  assert.ok(node.devices.includes('/dev/mpp_service:/dev/mpp_service'))
  assert.ok(app.volumes.includes('/srv/家庭 KTV/singverse-data:/data'))
  assert.ok(app.volumes.some(mount => mount.source === c.mediaPath && !mount.bind.create_host_path && mount.read_only))
  assert.ok(node.volumes.includes('/srv/家庭 KTV/singverse-compute-auth:/run/singverse-compute'))
})
test('inactive compute or MySQL fields do not block app-only / SQLite deployments', () => {
  assert.equal(validate({ ...defaults(), mode: 'app', arch: 'arm64', computeMemory: '', gpuId: '', mysqlHost: '' }).length, 0)
  assert.equal(buildCompose({ ...defaults(), mode: 'app', arch: 'arm64' }).services['singverse-go-backend'].platform, 'linux/arm64')
})
