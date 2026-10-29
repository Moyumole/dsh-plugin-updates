import test from 'node:test'
import assert from 'node:assert/strict'

import { createRegistry } from '../lib/src/registry.js'

const npm = 'https://registry.npmjs.org/'
const mirror = 'https://registry.npmmirror.com/'

function okResponse(manifest, status = 200) {
  return { ok: true, status, json: async () => manifest }
}

function createFetch(handler) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    return handler(url, init, calls.length)
  }
  return { calls, fetchImpl }
}

test('latestManifest encodes scoped package names in the registry path', async () => {
  const { calls, fetchImpl } = createFetch(() => okResponse({ name: '@scope/name', version: '1.2.3' }))
  const registry = createRegistry({ fetchImpl, registries: [npm], now: () => 0 })

  const result = await registry.latestManifest('@scope/name')

  assert.deepEqual(result, {
    ok: true,
    manifest: { name: '@scope/name', version: '1.2.3' },
    registry: npm,
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://registry.npmjs.org/@scope%2Fname/latest')
  assert.ok(calls[0].init && calls[0].init.signal, 'the abort signal is forwarded to fetch')
})

test('latestManifest keeps plain names and normalizes registry base URLs', async () => {
  const { calls, fetchImpl } = createFetch(() => okResponse({ name: 'dsh-pet', version: '0.3.8' }))
  const registry = createRegistry({
    fetchImpl,
    registries: ['https://example.test', 'https://fallback.test/'],
    now: () => 0,
  })

  const result = await registry.latestManifest('dsh-pet')

  assert.equal(result.ok, true)
  assert.equal(result.registry, 'https://example.test/')
  assert.equal(calls[0].url, 'https://example.test/dsh-pet/latest')
})

test('latestManifest falls back to the next registry when the first one fails', async () => {
  const { calls, fetchImpl } = createFetch((url) => (
    url.startsWith(npm)
      ? { ok: false, status: 404 }
      : okResponse({ name: 'dsh-pet', version: '0.3.8' })
  ))
  const registry = createRegistry({ fetchImpl, now: () => 0 })

  const result = await registry.latestManifest('dsh-pet')

  assert.equal(result.ok, true)
  assert.equal(result.registry, mirror)
  assert.deepEqual(calls.map((call) => call.url), [
    `${npm}dsh-pet/latest`,
    `${mirror}dsh-pet/latest`,
  ])
})

test('latestManifest reports the last error when every registry fails', async () => {
  const { fetchImpl } = createFetch((url) => (
    url.startsWith(npm) ? { ok: false, status: 500 } : { ok: false, status: 404 }
  ))
  const registry = createRegistry({ fetchImpl, now: () => 0 })

  assert.deepEqual(await registry.latestManifest('dsh-pet'), {
    ok: false,
    error: 'HTTP 404',
    registry: mirror,
  })
})

test('successful lookups are cached for ttlMs', async () => {
  let clock = 1000
  const { calls, fetchImpl } = createFetch(() => okResponse({ name: 'dsh-pet', version: '0.3.8' }))
  const registry = createRegistry({ fetchImpl, now: () => clock, ttlMs: 600000 })

  const first = await registry.latestManifest('dsh-pet')
  clock += 599999
  const cached = await registry.latestManifest('dsh-pet')
  assert.equal(calls.length, 1)
  assert.equal(registry.size(), 1)
  assert.deepEqual(cached, first)

  clock += 2
  await registry.latestManifest('dsh-pet')
  assert.equal(calls.length, 2)
})

test('failed lookups are not cached', async () => {
  let attempt = 0
  const fetchImpl = async () => {
    attempt += 1
    if (attempt === 1) throw new TypeError('fetch failed')
    return okResponse({ name: 'dsh-pet', version: '0.3.8' })
  }
  const registry = createRegistry({ fetchImpl, registries: [npm], now: () => 0 })

  const first = await registry.latestManifest('dsh-pet')
  assert.equal(first.ok, false)
  assert.equal(first.error, 'network error')
  assert.equal(registry.size(), 0)

  const second = await registry.latestManifest('dsh-pet')
  assert.equal(second.ok, true)
  assert.equal(registry.size(), 1)
})

test('latestManifest times out when the registry never answers', async () => {
  const registry = createRegistry({
    fetchImpl: () => new Promise(() => {}),
    registries: [npm],
    now: () => 0,
    timeoutMs: 25,
  })

  assert.deepEqual(await registry.latestManifest('dsh-pet'), {
    ok: false,
    error: 'timeout',
    registry: npm,
  })
})

test('latestManifest reports non-2xx responses', async () => {
  const registry = createRegistry({
    fetchImpl: async () => ({ ok: false, status: 503 }),
    registries: [npm],
    now: () => 0,
  })

  assert.deepEqual(await registry.latestManifest('dsh-pet'), {
    ok: false,
    error: 'HTTP 503',
    registry: npm,
  })
})

test('latestManifest reports invalid JSON', async () => {
  const registry = createRegistry({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token <') },
    }),
    registries: [npm],
    now: () => 0,
  })

  assert.deepEqual(await registry.latestManifest('dsh-pet'), {
    ok: false,
    error: 'invalid JSON',
    registry: npm,
  })
})

test('latestManifest rejects manifests without a version', async () => {
  const registry = createRegistry({
    fetchImpl: async () => okResponse({ name: 'dsh-pet' }),
    registries: [npm],
    now: () => 0,
  })

  assert.deepEqual(await registry.latestManifest('dsh-pet'), {
    ok: false,
    error: 'missing version',
    registry: npm,
  })
})

test('clear() drops cached manifests', async () => {
  const { calls, fetchImpl } = createFetch(() => okResponse({ name: 'dsh-pet', version: '0.3.8' }))
  const registry = createRegistry({ fetchImpl, registries: [npm], now: () => 0 })

  await registry.latestManifest('dsh-pet')
  assert.equal(registry.size(), 1)
  registry.clear()
  assert.equal(registry.size(), 0)
  await registry.latestManifest('dsh-pet')
  assert.equal(calls.length, 2)
})

test('latestManifest rejects invalid package names without fetching', async () => {
  const { calls, fetchImpl } = createFetch(() => okResponse({ name: 'x', version: '1.0.0' }))
  const registry = createRegistry({ fetchImpl })

  assert.deepEqual(await registry.latestManifest(''), { ok: false, error: 'invalid name' })
  assert.deepEqual(await registry.latestManifest('   '), { ok: false, error: 'invalid name' })
  assert.deepEqual(await registry.latestManifest(null), { ok: false, error: 'invalid name' })
  assert.equal(calls.length, 0)
})

test('latestManifest stops early when the caller signal is already aborted', async () => {
  const { calls, fetchImpl } = createFetch(() => okResponse({ name: 'x', version: '1.0.0' }))
  const registry = createRegistry({ fetchImpl, registries: [npm], now: () => 0, timeoutMs: 1000 })
  const controller = new AbortController()
  controller.abort()

  const result = await registry.latestManifest('dsh-pet', { signal: controller.signal })

  assert.deepEqual(result, { ok: false, error: 'aborted' })
  assert.equal(calls.length, 0)
})

test('latestManifest refuses names that could escape the registry path', async () => {
  const { calls, fetchImpl } = createFetch(() => okResponse({ version: '1.0.0' }))
  const registry = createRegistry({ fetchImpl })

  const names = [
    '../evil',
    '../../etc/passwd',
    'evil?x=1',
    'evil#frag',
    '@scope/../evil',
    '@scope/',
    'UPPER',
    'a'.repeat(215),
  ]
  for (const name of names) {
    assert.deepEqual(await registry.latestManifest(name), { ok: false, error: 'invalid name' }, name)
  }
  assert.equal(calls.length, 0, 'no request is made for a rejected name')
})

test('latestManifest rejects an oversized manifest before parsing it', async () => {
  const { calls, fetchImpl } = createFetch(() => ({
    ok: true,
    status: 200,
    headers: { get: (name) => (name === 'content-length' ? '3000000' : null) },
    json: async () => {
      throw new Error('must not parse an oversized body')
    },
  }))
  const registry = createRegistry({ fetchImpl, now: () => 0 })

  const result = await registry.latestManifest('dsh-pet')

  assert.deepEqual(result, { ok: false, error: 'response too large', registry: mirror })
  assert.equal(calls.length, 2, 'both registries are asked once')
})
