#!/usr/bin/env node
/**
 * Development aid: print the rows the panel would show for the live profile.
 *
 * Reads the profile's dependencies and installed versions from disk, asks the
 * real npm registry (the same fallback order the browser half uses), and runs
 * the real row builder. Useful for checking M1 without a browser.
 *
 * Usage: node scripts/preview-rows.mjs [runtimeVersion]
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { createRegistry } from '../lib/src/registry.js'
import { buildRows } from '../lib/src/rows.js'

const profileDir = process.env.DSH_PROFILE_DIR
if (profileDir === undefined) {
  console.error('DSH_PROFILE_DIR is not set; run this inside a dsh profile shell')
  process.exit(1)
}

const runtimeVersion = process.argv[2] ?? '0.2.1-rc.3'
const manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'))
const dependencies = manifest.dependencies ?? {}

const bundles = []
for (const [name, spec] of Object.entries(dependencies)) {
  let version
  try {
    version = JSON.parse(await readFile(join(profileDir, 'node_modules', name, 'package.json'), 'utf8')).version
  } catch {
    version = undefined
  }
  bundles.push({
    name,
    official: false,
    availability: 'profile',
    version,
    enabled: true,
    installed: true,
    source: `${name}@${spec}`,
    optional: false,
    removable: true,
    rows: [],
    overrides: [],
  })
}
bundles.push({
  name: '@deepseek-ai/dsh-base',
  official: false,
  availability: 'installation',
  version: runtimeVersion,
  enabled: true,
  installed: false,
  optional: false,
  removable: false,
  rows: [],
  overrides: [],
})

const registry = createRegistry()
const manifests = {}
const errors = {}
await Promise.all(
  bundles.map(async (bundle) => {
    if (!/^(@[^/]+\/)?[^@:\s]+(@[^:\s]*)?$/.test(bundle.source) || /^(file|link|git|https?|workspace):/.test(bundle.source)) return
    const answer = await registry.latestManifest(bundle.name)
    if (answer.ok) manifests[bundle.name] = answer.manifest
    else errors[bundle.name] = answer.error
  }),
)

const built = buildRows({
  bundles,
  manifests,
  errors,
  localeId: 'zh',
  runtimeVersion,
  selfName: '@moyumole/dsh-plugin-updates',
})

console.log(JSON.stringify({ runtimeVersion, ...built }, null, 2))
