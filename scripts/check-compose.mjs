import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { defaults, presets, generate } from '../src/lib/deployment/compose.mjs'
const cases = presets.flatMap(p => ['stack', 'app', 'node'].map(mode => ({ ...defaults(p.id), mode })))
cases.push({ ...defaults(), mode: 'app', arch: 'arm64' }, { ...defaults('rk3566'), mpp: true })
for (const hardware of presets.map(p => p.id)) cases.push({ ...defaults(hardware), database: 'mysql', mysqlHost: 'db.internal', mysqlPassword: 'compose-test-$HOME-${UNSET}-$$-"-\\-中文', dataRoot: './data with $literal and 空格', port: 18234, mediaPath: '/media/音乐' })
for (const c of cases) {
  const result = spawnSync('docker', ['compose', '--env-file', '/dev/null', '--project-directory', process.cwd(), '-f', '-', 'config', '--format', 'json'], { input: generate(c), encoding: 'utf8' })
  assert.equal(result.status, 0, `${c.hardware}/${c.mode}: ${result.error?.message || result.stderr}`)
  assert.equal(result.stderr.trim(), '', `${c.hardware}: unexpected Compose warning`)
  const parsed = JSON.parse(result.stdout)
  assert.equal(Object.keys(parsed.services).length, c.mode === 'stack' ? 2 : 1)
  const app = parsed.services['singverse-go-backend']
  if (app && c.database === 'mysql') assert.ok([c.mysqlPassword, c.mysqlPassword.replaceAll('$', () => '$$')].includes(app.environment.MYSQL_PASSWORD), 'Canonical Compose output changed literal password')
  assert.ok(Object.values(parsed.services).every(service => service.volumes.every(mount => mount.type === 'bind')))
  if (c.database === 'mysql') assert.ok(app.volumes.some(mount => mount.source.includes('$literal')))
}
console.log(`PASS: ${cases.length} configurations parsed by Docker Compose with no .env; literal values safely serialized and bind mounts preserved. No containers started.`)
