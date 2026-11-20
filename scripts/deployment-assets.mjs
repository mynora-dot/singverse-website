import { mkdirSync, writeFileSync } from 'node:fs'
import { defaults, presets, generate } from '../src/lib/deployment/compose.mjs'
mkdirSync('public/deploy', { recursive: true })
for (const preset of presets) writeFileSync(`public/deploy/${preset.id}.yaml`, generate(defaults(preset.id)))
for (const arch of ['amd64', 'arm64']) writeFileSync(`public/deploy/app-${arch}.yaml`, generate({ ...defaults(), mode: 'app', arch }))
console.log('Generated six download templates from the Compose builder.')
