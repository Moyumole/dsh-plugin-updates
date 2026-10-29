import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STATUS,
  buildRows,
  isRegistrySource,
  isThirdPartyBundle,
  pickLocalized,
  sortRows,
} from '../lib/src/rows.js'

const runtimeVersion = '0.2.1-rc.3'
const selfName = '@moyumole/dsh-plugin-updates'

function bundle(overrides) {
  return {
    official: false,
    availability: 'profile',
    installed: true,
    enabled: true,
    version: '1.0.0',
    ...overrides,
  }
}

const bundles = [
  bundle({
    name: 'dsh-pet',
    version: '0.3.7',
    source: 'dsh-pet@^0.3.7',
    meta: {
      title: { en: 'Pet', zh: '宠物' },
      description: { en: 'A pet', zh: '一只宠物' },
    },
  }),
  bundle({ name: 'dsh-context', version: '0.77.0', source: 'dsh-context@^0.77.0' }),
  bundle({ name: 'dsh-whale-widget', version: '0.4.2', source: 'dsh-whale-widget@0.4.2' }),
  bundle({ name: 'dsh-failed', version: '2.0.0', source: 'dsh-failed@^2.0.0' }),
  bundle({ name: 'dsh-local', version: '1.0.0', source: 'file:../dsh-local' }),
  bundle({ name: 'dsh-unsourced', version: '1.0.0' }),
  bundle({ name: 'dsh-official', official: true, version: '9.9.9', source: '@deepseek-ai/dsh-official@9.9.9' }),
  bundle({ name: selfName, version: '0.1.0', source: `${selfName}@0.1.0` }),
  bundle({ name: 'dsh-missing', version: '1.0.0', source: 'dsh-missing@1.0.0', availability: 'missing', installed: false }),
]

const manifests = {
  'dsh-pet': { name: 'dsh-pet', version: '0.3.8' },
  'dsh-context': { name: 'dsh-context', version: '0.78.1', engines: { dsh: '>=0.3.0' } },
  'dsh-whale-widget': { name: 'dsh-whale-widget', version: '0.4.2' },
}

const errors = { 'dsh-failed': 'HTTP 404' }

test('buildRows filters official, missing, uninstalled and self bundles', () => {
  const result = buildRows({
    bundles,
    manifests,
    errors,
    localeId: 'en-US',
    runtimeVersion,
    selfName,
  })

  assert.deepEqual(result.rows.map((row) => row.name), [
    'dsh-pet',
    'dsh-context',
    'dsh-failed',
    'dsh-local',
    'dsh-unsourced',
    'dsh-whale-widget',
  ])
  assert.deepEqual(result.rows.map((row) => row.status), [
    STATUS.update,
    STATUS.incompatible,
    STATUS.failed,
    STATUS.unsupported,
    STATUS.unsupported,
    STATUS.latest,
  ])
})

test('buildRows resolves localized meta and computes counts', () => {
  const result = buildRows({
    bundles,
    manifests,
    errors,
    localeId: 'zh-CN',
    runtimeVersion,
    selfName,
  })

  assert.equal(result.rows.length, 6)
  assert.equal(result.updateCount, 1)
  assert.equal(result.incompatibleCount, 1)
  assert.equal(result.failedCount, 1)

  const pet = result.rows.find((row) => row.name === 'dsh-pet')
  assert.deepEqual(pet, {
    name: 'dsh-pet',
    title: '宠物',
    description: '一只宠物',
    currentVersion: '0.3.7',
    latestVersion: '0.3.8',
    status: STATUS.update,
    source: 'dsh-pet@^0.3.7',
  })

  const context = result.rows.find((row) => row.name === 'dsh-context')
  assert.equal(context.status, STATUS.incompatible)
  assert.deepEqual(context.requirements, { 'engines.dsh': '>=0.3.0' })

  const failed = result.rows.find((row) => row.name === 'dsh-failed')
  assert.equal(failed.status, STATUS.failed)
  assert.equal(failed.reason, 'HTTP 404')
  assert.equal(failed.latestVersion, null)

  const local = result.rows.find((row) => row.name === 'dsh-local')
  assert.equal(local.status, STATUS.unsupported)
  assert.equal(local.source, 'file:../dsh-local')

  const whale = result.rows.find((row) => row.name === 'dsh-whale-widget')
  assert.equal(whale.status, STATUS.latest)
  assert.equal(whale.latestVersion, '0.4.2')
})

test('buildRows falls back to the bundle name when no localized title exists', () => {
  const result = buildRows({
    bundles: [bundle({ name: 'dsh-pet', version: '0.3.7', source: 'dsh-pet@^0.3.7' })],
    manifests: { 'dsh-pet': { name: 'dsh-pet', version: '0.3.8' } },
    errors: {},
    localeId: 'en-US',
    runtimeVersion,
    selfName,
  })

  assert.equal(result.rows[0].title, 'dsh-pet')
  assert.equal(result.rows[0].description, '')
})

test('buildRows cannot judge compatibility without a runtime version', () => {
  const result = buildRows({
    bundles: [bundle({ name: 'dsh-context', version: '0.77.0', source: 'dsh-context@^0.77.0' })],
    manifests: {
      'dsh-context': {
        name: 'dsh-context',
        version: '0.78.1',
        engines: { dsh: '>=0.3.0' },
      },
    },
    errors: {},
    localeId: 'en-US',
    runtimeVersion: undefined,
    selfName,
  })

  assert.equal(result.rows[0].status, STATUS.update)
  assert.equal(result.rows[0].requirements, undefined)
})

test('errors take precedence over manifests for the same package', () => {
  const result = buildRows({
    bundles: [bundle({ name: 'dsh-pet', version: '0.3.7', source: 'dsh-pet@^0.3.7' })],
    manifests: { 'dsh-pet': { name: 'dsh-pet', version: '0.3.8' } },
    errors: { 'dsh-pet': 'timeout' },
    localeId: 'en-US',
    runtimeVersion,
    selfName,
  })

  assert.equal(result.rows[0].status, STATUS.failed)
  assert.equal(result.rows[0].reason, 'timeout')
})

test('a missing manifest without an error is reported as a failed check', () => {
  const result = buildRows({
    bundles: [bundle({ name: 'dsh-pet', version: '0.3.7', source: 'dsh-pet@^0.3.7' })],
    manifests: {},
    errors: {},
    localeId: 'en-US',
    runtimeVersion,
    selfName,
  })

  assert.equal(result.rows[0].status, STATUS.failed)
  assert.equal(result.rows[0].latestVersion, null)
  assert.equal(result.failedCount, 1)
})

test('buildRows handles an empty bundle list', () => {
  const result = buildRows({
    bundles: [],
    manifests: {},
    errors: {},
    localeId: 'en-US',
    runtimeVersion,
    selfName,
  })

  assert.deepEqual(result, { rows: [], updateCount: 0, incompatibleCount: 0, failedCount: 0 })
})

test('pickLocalized resolves strings and locale maps', () => {
  assert.equal(pickLocalized('plain', 'zh-CN'), 'plain')
  assert.equal(pickLocalized({ en: 'English', zh: '中文' }, 'zh-CN'), '中文')
  assert.equal(pickLocalized({ en: 'English', zh: '中文' }, 'zh'), '中文')
  assert.equal(pickLocalized({ en: 'English', zh: '中文' }, 'en-US'), 'English')
  assert.equal(pickLocalized({ zh: '只有中文' }, 'en-US'), '只有中文')
  assert.equal(pickLocalized({ en: '只有英文' }, 'zh-CN'), '只有英文')
  assert.equal(pickLocalized({ en: 'English' }, 'fr-FR'), 'English')
  assert.equal(pickLocalized(undefined, 'en'), undefined)
  assert.equal(pickLocalized(42, 'en'), undefined)
  assert.equal(pickLocalized({}, 'en'), undefined)
})

test('isThirdPartyBundle requires a profile-installed non-official bundle other than self', () => {
  assert.equal(isThirdPartyBundle(bundle({ name: 'dsh-pet' }), selfName), true)
  assert.equal(isThirdPartyBundle(bundle({ name: 'dsh-pet', official: true }), selfName), false)
  assert.equal(isThirdPartyBundle(bundle({ name: 'dsh-pet', availability: 'installation' }), selfName), false)
  assert.equal(isThirdPartyBundle(bundle({ name: 'dsh-pet', availability: 'missing' }), selfName), false)
  assert.equal(isThirdPartyBundle(bundle({ name: 'dsh-pet', installed: false }), selfName), false)
  assert.equal(isThirdPartyBundle(bundle({ name: selfName }), selfName), false)
  assert.equal(isThirdPartyBundle(null, selfName), false)
  assert.equal(isThirdPartyBundle(bundle({ name: '' }), selfName), false)
})

test('isRegistrySource accepts npm package specs only', () => {
  assert.equal(isRegistrySource('dsh-pet@^0.3.7', 'dsh-pet'), true)
  assert.equal(isRegistrySource('dsh-pet', 'dsh-pet'), true)
  assert.equal(isRegistrySource('dsh-pet@0.3.7', 'dsh-pet'), true)
  assert.equal(isRegistrySource(' dsh-pet@^0.3.7 ', 'dsh-pet'), true)
  assert.equal(isRegistrySource('@scope/pkg@^1.0.0', '@scope/pkg'), true)
  assert.equal(isRegistrySource('@scope/pkg', '@scope/pkg'), true)
  assert.equal(isRegistrySource('dsh-pet@', 'dsh-pet'), false)
  assert.equal(isRegistrySource('dsh-pet-extra@^1.0.0', 'dsh-pet'), false)
  assert.equal(isRegistrySource('file:../dsh-pet', 'dsh-pet'), false)
  assert.equal(isRegistrySource('link:../dsh-pet', 'dsh-pet'), false)
  assert.equal(isRegistrySource('workspace:*', 'dsh-pet'), false)
  assert.equal(isRegistrySource(undefined, 'dsh-pet'), false)
})

test('sortRows orders update, incompatible, failed, unsupported, latest', () => {
  const rows = [
    { name: 'a', status: STATUS.latest },
    { name: 'b', status: STATUS.unsupported },
    { name: 'c', status: STATUS.failed },
    { name: 'd', status: STATUS.incompatible },
    { name: 'e', status: STATUS.update },
  ]

  assert.deepEqual(sortRows(rows).map((row) => row.name), ['e', 'd', 'c', 'b', 'a'])
  assert.deepEqual(rows.map((row) => row.name), ['a', 'b', 'c', 'd', 'e'])
  assert.deepEqual(sortRows([]), [])
})

test('sortRows breaks status ties by bundle name ascending', () => {
  const rows = [
    { name: 'zeta', status: STATUS.update },
    { name: 'alpha', status: STATUS.update },
    { name: 'beta', status: STATUS.latest },
    { name: 'aardvark', status: STATUS.latest },
  ]

  assert.deepEqual(sortRows(rows).map((row) => row.name), ['alpha', 'zeta', 'aardvark', 'beta'])
})
