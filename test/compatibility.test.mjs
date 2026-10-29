import test from 'node:test'
import assert from 'node:assert/strict'

import { evaluateCompatibility, unmetRequirements } from '../lib/src/compatibility.js'

const runtime = '0.2.1-rc.3'

test('engines.dsh takes precedence over peerDependencies', () => {
  const manifest = {
    name: 'p',
    version: '1.0.0',
    engines: { dsh: '>=0.2.0' },
    peerDependencies: { '@deepseek-ai/dsh': '>=9.0.0' },
  }
  assert.deepEqual(unmetRequirements(manifest, runtime), {})
  assert.equal(evaluateCompatibility(manifest, runtime), undefined)
})

test('an unsatisfied engines.dsh is reported and peers are ignored', () => {
  const manifest = {
    name: 'p',
    version: '1.1.0',
    engines: { dsh: '>=0.3.0' },
    peerDependencies: { '@deepseek-ai/dsh': '>=0.1.0' },
  }
  assert.deepEqual(unmetRequirements(manifest, runtime), { 'engines.dsh': '>=0.3.0' })
  assert.deepEqual(evaluateCompatibility(manifest, runtime), {
    name: 'p',
    version: '1.1.0',
    requirements: { 'engines.dsh': '>=0.3.0' },
  })
})

test('@deepseek-ai/dsh and @deepseek-ai/dsh-* peers are checked, others ignored', () => {
  const manifest = {
    name: 'p',
    version: '1.0.0',
    peerDependencies: {
      '@deepseek-ai/dsh': '>=0.1.0',
      '@deepseek-ai/dsh-api-remotes': '^0.2.1-rc.1',
      '@deepseek-ai/dsh-client-locale': '>=0.3.0',
      react: '^18.0.0',
    },
  }
  assert.deepEqual(unmetRequirements(manifest, runtime), {
    '@deepseek-ai/dsh-client-locale': '>=0.3.0',
  })
  assert.deepEqual(evaluateCompatibility(manifest, runtime), {
    name: 'p',
    version: '1.0.0',
    requirements: { '@deepseek-ai/dsh-client-locale': '>=0.3.0' },
  })
})

test('peer names that only share the dsh prefix without a dash are ignored', () => {
  const manifest = {
    name: 'p',
    peerDependencies: {
      '@deepseek-ai/dshx': '>=99.0.0',
      '@deepseek-ai/dsh2': '>=99.0.0',
      '@other/dsh-client': '>=99.0.0',
    },
  }
  assert.deepEqual(unmetRequirements(manifest, runtime), {})
})

test('workspace protocol peers count as satisfied', () => {
  const manifest = {
    name: 'p',
    peerDependencies: {
      '@deepseek-ai/dsh': 'workspace:^',
      '@deepseek-ai/dsh-api-remotes': 'workspace:~',
      '@deepseek-ai/dsh-client-locale': 'workspace:*',
    },
  }
  assert.deepEqual(unmetRequirements(manifest, runtime), {})
})

test('empty and invalid requirement ranges are unmet', () => {
  assert.deepEqual(
    unmetRequirements({ name: 'p', peerDependencies: { '@deepseek-ai/dsh': '' } }, runtime),
    { '@deepseek-ai/dsh': '' },
  )
  assert.deepEqual(
    unmetRequirements({ name: 'p', peerDependencies: { '@deepseek-ai/dsh': '^not-a-range' } }, runtime),
    { '@deepseek-ai/dsh': '^not-a-range' },
  )
  assert.deepEqual(
    unmetRequirements({ name: 'p', engines: { dsh: '' } }, runtime),
    { 'engines.dsh': '' },
  )
})

test('a non-semver runtime version skips compatibility checks', () => {
  const manifest = { name: 'p', engines: { dsh: '>=9.0.0' } }
  assert.deepEqual(unmetRequirements(manifest, 'not-a-version'), {})
  assert.equal(evaluateCompatibility(manifest, 'not-a-version'), undefined)
  assert.equal(evaluateCompatibility(manifest, undefined), undefined)
  assert.equal(evaluateCompatibility(manifest, null), undefined)
})

test('manifests without dsh requirements are compatible', () => {
  assert.deepEqual(
    unmetRequirements({ name: 'p', version: '1.0.0', peerDependencies: { react: '^18.0.0' } }, runtime),
    {},
  )
  assert.equal(evaluateCompatibility({ name: 'p', version: '1.0.0' }, runtime), undefined)
  assert.deepEqual(unmetRequirements(null, runtime), {})
  assert.deepEqual(unmetRequirements(undefined, runtime), {})
  assert.equal(evaluateCompatibility(undefined, runtime), undefined)
})
