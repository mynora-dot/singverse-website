import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { appParameters, computeParameters, mysqlParameters } from '../src/lib/deployment/parameters.mjs'
const args = process.argv.slice(2)
const option = key => args[args.indexOf(key) + 1]
assert.ok(args.includes('--go') && args.includes('--compute'), 'Pass explicit --go /path/to/go and --compute /path/to/compute checkouts.')
const go = readFileSync(resolve(option('--go'), 'internal/platform/config/config.go'), 'utf8')
const compute = readFileSync(resolve(option('--compute'), 'singverse_compute/core/config.py'), 'utf8')
const goKeys = new Set([...go.matchAll(/(?:get|value)\("([A-Z][A-Z0-9_]+)"/g)].map(match => match[1]))
const computeKeys = new Set([...compute.matchAll(/['"](COMPUTE_[A-Z0-9_]+)['"]/g)].map(match => match[1]))
assert.deepEqual([...goKeys].sort(), [...appParameters, ...mysqlParameters].map(p => p.key).sort())
assert.deepEqual([...computeKeys].sort(), computeParameters.map(p => p.key).sort())
console.log(`PASS: parameter reference covers all ${goKeys.size} Go keys (including MySQL) and ${computeKeys.size} compute keys in explicit source checkouts.`)
