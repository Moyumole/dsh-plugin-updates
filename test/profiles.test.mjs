import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PROFILES_ROUTE,
  buildProfileSummaries,
  profileBundle,
  profilePluginNames,
  profileTotalUpdates,
} from '../lib/src/profiles.js'

const PAYLOAD = {
  profiles: [
    {
      name: 'desktop',
      plugins: [
        { name: 'dsh-pet', version: '0.3.7', source: '^0.3.7' },
        { name: 'dsh-whale-widget', version: '0.4.2', source: '^0.4.2' },
        { name: 'broken', version: null, source: '^1.0.0' },
      ],
    },
    { name: 'empty', plugins: [] },
  ],
}

const MANIFESTS = {
  'dsh-pet': { name: 'dsh-pet', version: '0.3.8' },
  'dsh-whale-widget': { name: 'dsh-whale-widget', version: '0.4.2' },
}

test('the route the host serves and the client fetches is one constant', () => {
  assert.equal(PROFILES_ROUTE, '/plugin-updates/profiles')
})

test('profileBundle maps an inventory plugin onto the BundleInfo shape', () => {
  assert.deepEqual(profileBundle({ name: 'dsh-pet', version: '0.3.7', source: '^0.3.7' }), {
    name: 'dsh-pet',
    official: false,
    availability: 'profile',
    version: '0.3.7',
    description: '',
    enabled: true,
    installed: true,
    source: 'dsh-pet@^0.3.7',
    optional: false,
    removable: true,
    rows: [],
    overrides: [],
  })
  assert.equal(profileBundle({ name: 'x', version: null }).version, null)
  assert.equal(profileBundle({ name: 'x', source: 'link:D:/tmp/x' }).source, 'link:D:/tmp/x')
})

test('profilePluginNames collects each package once, sorted', () => {
  assert.deepEqual(profilePluginNames(PAYLOAD), ['broken', 'dsh-pet', 'dsh-whale-widget'])
  assert.deepEqual(profilePluginNames({}), [])
  assert.deepEqual(profilePluginNames(null), [])
})

test('buildProfileSummaries reuses the row builder per profile', () => {
  const summaries = buildProfileSummaries(PAYLOAD, {
    manifests: MANIFESTS,
    errors: {},
    runtimeVersion: '0.2.1-rc.3',
    localeId: 'en',
    selfName: 'dsh-plugin-updates',
  })

  assert.deepEqual(summaries.map((profile) => profile.name), ['desktop', 'empty'])
  assert.equal(summaries[0].updateCount, 1)
  assert.equal(summaries[0].rows.find((row) => row.name === 'dsh-pet').status, 'update')
  assert.equal(summaries[0].rows.find((row) => row.name === 'dsh-whale-widget').status, 'latest')
  assert.equal(summaries[0].rows.find((row) => row.name === 'broken').status, 'failed')
  assert.equal(summaries[1].updateCount, 0)
  assert.equal(profileTotalUpdates(summaries), 1)
})

test('a registry error only fails that row in its profile', () => {
  const summaries = buildProfileSummaries(PAYLOAD, {
    manifests: { 'dsh-whale-widget': MANIFESTS['dsh-whale-widget'] },
    errors: { 'dsh-pet': 'HTTP 503' },
    runtimeVersion: '0.2.1-rc.3',
    localeId: 'zh-CN',
    selfName: 'dsh-plugin-updates',
  })

  assert.equal(summaries[0].rows.find((row) => row.name === 'dsh-pet').status, 'failed')
  assert.equal(summaries[0].rows.find((row) => row.name === 'dsh-pet').reason, 'HTTP 503')
  assert.equal(summaries[0].rows.find((row) => row.name === 'dsh-whale-widget').status, 'latest')
  assert.equal(summaries[0].updateCount, 0)
})

test('the profile that is already rendered by the panel is excluded', () => {
  const summaries = buildProfileSummaries(
    { currentProfile: 'desktop', profiles: PAYLOAD.profiles },
    { manifests: MANIFESTS, errors: {}, runtimeVersion: '0.2.1-rc.3', localeId: 'en', selfName: 'dsh-plugin-updates' },
  )

  assert.deepEqual(summaries.map((profile) => profile.name), ['empty'])
})

test('malformed inventories degrade to no summaries', () => {
  assert.deepEqual(buildProfileSummaries({}, {}), [])
  assert.deepEqual(buildProfileSummaries(null, undefined), [])
  assert.deepEqual(profileTotalUpdates(undefined), 0)
})
