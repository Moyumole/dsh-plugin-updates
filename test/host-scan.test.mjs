import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { scanProfiles, currentProfileName } from '../lib/index.js'

/** Create `<root>/profiles/<name>/package.json` (+ optional installed versions). */
async function makeProfile(root, name, dependencies, installed = {}) {
  const dir = path.join(root, 'profiles', name)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'package.json'), JSON.stringify({ dependencies }, null, 2), 'utf8')
  for (const [plugin, version] of Object.entries(installed)) {
    const pluginDir = path.join(dir, 'node_modules', ...plugin.split('/'))
    await mkdir(pluginDir, { recursive: true })
    await writeFile(path.join(pluginDir, 'package.json'), JSON.stringify({ name: plugin, version }), 'utf8')
  }
  return dir
}

test('scanProfiles lists third-party plugins and their installed versions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-profiles-'))
  try {
    await makeProfile(
      root,
      'desktop',
      {
        'dsh-pet': '^0.3.8',
        'dsh-whale-widget': 'link:D:/tmp/whale',
        '@deepseek-ai/dsh-base': '0.2.1-rc.3',
        '@moyumole/dsh-plugin-updates': 'link:D:/tmp/updates',
      },
      { 'dsh-pet': '0.3.8' },
    )
    await makeProfile(root, 'web', {})

    const payload = await scanProfiles(root)

    assert.deepEqual(payload.profiles.map((profile) => profile.name), ['desktop', 'web'])
    const desktop = payload.profiles[0]
    assert.deepEqual(desktop.plugins, [
      { name: 'dsh-pet', version: '0.3.8', source: '^0.3.8' },
      { name: 'dsh-whale-widget', version: null, source: 'link:D:/tmp/whale' },
    ])
    assert.deepEqual(payload.profiles[1].plugins, [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('scanProfiles skips directories without a readable package.json', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-profiles-'))
  try {
    await makeProfile(root, 'desktop', { 'dsh-pet': '^0.3.8' }, { 'dsh-pet': '0.3.8' })
    await mkdir(path.join(root, 'profiles', 'not-a-profile'), { recursive: true })
    await mkdir(path.join(root, 'profiles', '.hidden'), { recursive: true })

    const payload = await scanProfiles(root)

    assert.deepEqual(payload.profiles.map((profile) => profile.name), ['desktop'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('scanProfiles degrades to an empty list without a profiles directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-profiles-'))
  try {
    assert.deepEqual(await scanProfiles(root), { profiles: [] })
    assert.deepEqual(await scanProfiles(path.join(root, 'missing')), { profiles: [] })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('currentProfileName reads the profile directory from the host argv', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-profiles-'))
  const profileDir = path.join(root, 'profiles', 'desktop')
  try {
    await mkdir(profileDir, { recursive: true })
    assert.equal(currentProfileName(root), null)
    process.argv.push(profileDir)
    assert.equal(currentProfileName(root), 'desktop')
  } finally {
    const index = process.argv.indexOf(profileDir)
    if (index !== -1) process.argv.splice(index, 1)
    await rm(root, { recursive: true, force: true })
  }
})
