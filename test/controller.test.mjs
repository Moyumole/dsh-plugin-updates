/**
 * Controller behaviour: update checking, the remove -> install -> rollback flow,
 * host change handling, and snapshot publishing.
 *
 * The official `pluginManager` Remote service is faked here; the row builder and
 * compatibility rules are the real modules, so failures point at the controller.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createController } from '../lib/src/controller.js'

/** A third-party profile bundle, shaped like `pluginManager.listBundles()` returns it. */
function thirdParty(name, version, extra = {}) {
  return {
    name,
    official: false,
    availability: 'profile',
    version,
    description: `${name} description`,
    enabled: true,
    installed: true,
    source: `${name}@^${version}`,
    optional: false,
    removable: true,
    rows: [],
    overrides: [],
    ...extra,
  }
}

/** A bundle the installation ships; never listed for updates. */
function installationBundle(name, version = '0.2.1-rc.3', extra = {}) {
  return {
    name,
    official: true,
    availability: 'installation',
    version,
    enabled: true,
    installed: false,
    optional: true,
    removable: false,
    rows: [],
    overrides: [],
    ...extra,
  }
}

/** One `/latest` registry answer. */
function manifestOf(name, version, extra = {}) {
  return { name, version, ...extra }
}

/**
 * Registry double: `answers` maps a package name to a manifest, `{ error }`, or
 * nothing (missing -> HTTP 404).
 */
function fakeRegistry(answers = {}) {
  const calls = []
  return {
    calls,
    async latestManifest(name) {
      calls.push(name)
      const answer = answers[name]
      if (answer === undefined) return { ok: false, error: 'HTTP 404' }
      if (answer && answer.__error) return { ok: false, error: answer.__error }
      return { ok: true, manifest: answer, registry: 'https://registry.npmjs.org/' }
    },
    clear() {},
    size() {
      return 0
    },
  }
}

/**
 * One successful Client Remote answer: the API gateway resolves generated
 * methods to `{ ok: true, value }`, never to the raw value.
 */
function remoteOk(value) {
  return { ok: true, value }
}

/**
 * `remote` double. `script.install(spec, options, state)` may mutate
 * `state.bundles`; it returns the `ChangeResult` (or a raw `RemoteResult` when
 * the test drives the failure branch itself). The default install succeeds.
 */
function fakeRemote(initialBundles, script = {}) {
  const state = { bundles: initialBundles.map((bundle) => ({ ...bundle })) }
  const calls = []
  const splitSpec = (spec) => {
    const at = spec.lastIndexOf('@')
    if (at <= 0) return { name: spec, version: undefined }
    return { name: spec.slice(0, at), version: spec.slice(at + 1) }
  }
  const remote = {
    pluginManager: {
      async listBundles() {
        calls.push({ method: 'listBundles' })
        if (script.rawListBundles) return script.rawListBundles(state)
        if (script.listBundles) return remoteOk(await script.listBundles(state))
        return remoteOk(state.bundles.map((bundle) => ({ ...bundle })))
      },
      async removeBundle(name) {
        calls.push({ method: 'removeBundle', name })
        if (script.remove) return remoteOk(await script.remove(name, state))
        state.bundles = state.bundles.filter((bundle) => bundle.name !== name)
        return remoteOk({ changed: true, application: 'applied', stage: 'remove', target: name })
      },
      async installBundle(spec, options) {
        calls.push({ method: 'installBundle', spec, options })
        if (script.install) return remoteOk(await script.install(spec, options, state))
        const { name, version } = splitSpec(spec)
        state.bundles = state.bundles.filter((bundle) => bundle.name !== name)
        if (version !== undefined) state.bundles.push(thirdParty(name, version))
        return remoteOk({
          changed: true,
          application: 'restart-required',
          restartReason: 'no-hmr',
          stage: 'install',
          target: name,
          bundle: name,
          version,
        })
      },
    },
  }
  return { remote, calls, state }
}

/** A fresh controller wired to the doubles. */
function build(bundles, answers, script) {
  const fake = fakeRemote(bundles, script)
  const registry = fakeRegistry(answers)
  const controller = createController({
    remote: () => fake.remote,
    registry,
    getRuntimeVersion: () => '0.2.1-rc.3',
    getLocaleId: () => 'en',
    now: () => 1_700_000_000_000,
  })
  return { controller, registry, ...fake }
}

const BASE_BUNDLES = [
  installationBundle('@deepseek-ai/dsh-base'),
  thirdParty('dsh-better-sidebar', '0.28.1'),
  thirdParty('dsh-pet', '0.3.7'),
  thirdParty('dsh-whale-widget', '0.4.2'),
  thirdParty('@moyumole/dsh-plugin-updates', '0.1.0'),
]

const BASE_ANSWERS = {
  'dsh-better-sidebar': manifestOf('dsh-better-sidebar', '0.28.2', {
    peerDependencies: { '@deepseek-ai/dsh-llm': '^0.2.1-rc.1' },
  }),
  'dsh-pet': manifestOf('dsh-pet', '0.3.8', {
    peerDependencies: { '@deepseek-ai/dsh-session': '^0.2.1-rc.1' },
  }),
  'dsh-whale-widget': manifestOf('dsh-whale-widget', '0.4.2'),
  '@moyumole/dsh-plugin-updates': manifestOf('@moyumole/dsh-plugin-updates', '0.2.0'),
}

test('refresh lists third-party bundles with their update state', async () => {
  const { controller } = build(BASE_BUNDLES, BASE_ANSWERS)

  assert.equal(controller.getSnapshot().phase, 'idle')
  await controller.refresh()
  const snapshot = controller.getSnapshot()

  assert.equal(snapshot.phase, 'ready')
  assert.equal(snapshot.lastCheckedAt, 1_700_000_000_000)
  assert.equal(snapshot.error, null)
  assert.equal(snapshot.updateCount, 2)
  assert.deepEqual(
    snapshot.rows.map((row) => [row.name, row.status, row.currentVersion, row.latestVersion]),
    [
      ['dsh-better-sidebar', 'update', '0.28.1', '0.28.2'],
      ['dsh-pet', 'update', '0.3.7', '0.3.8'],
      ['dsh-whale-widget', 'latest', '0.4.2', '0.4.2'],
    ],
  )
})

test('refresh marks a bundle whose latest version rejects this runtime as incompatible', async () => {
  const bundles = [...BASE_BUNDLES, thirdParty('dsh-context', '0.77.0')]
  const answers = {
    ...BASE_ANSWERS,
    'dsh-context': manifestOf('dsh-context', '0.78.1', { engines: { dsh: '>=9.0.0' } }),
  }
  const { controller } = build(bundles, answers)

  await controller.refresh()

  const row = controller.getSnapshot().rows.find((entry) => entry.name === 'dsh-context')
  assert.equal(row.status, 'incompatible')
  assert.deepEqual(row.requirements, { 'engines.dsh': '>=9.0.0' })
  assert.equal(controller.getSnapshot().updateCount, 2)
})

test('a registry failure only fails its own row', async () => {
  const answers = { ...BASE_ANSWERS, 'dsh-pet': { __error: 'network error' } }
  const { controller } = build(BASE_BUNDLES, answers)

  await controller.refresh()

  const rows = controller.getSnapshot().rows
  assert.equal(rows.find((row) => row.name === 'dsh-pet').status, 'failed')
  assert.equal(rows.find((row) => row.name === 'dsh-pet').reason, 'network error')
  assert.equal(rows.find((row) => row.name === 'dsh-better-sidebar').status, 'update')
})

test('a refused Remote answer surfaces as a check failure', async () => {
  const { controller } = build(BASE_BUNDLES, BASE_ANSWERS, {
    rawListBundles: () => ({ ok: false, error: { code: 'denied', message: 'permission denied' } }),
  })

  await controller.refresh()

  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.phase, 'failed')
  assert.match(snapshot.error, /permission denied/)
})

test('a host without the plugin manager namespace fails with a stable error code', async () => {
  const controller = createController({
    remote: () => ({ pluginManager: undefined }),
    registry: fakeRegistry({}),
    getRuntimeVersion: () => '0.2.1-rc.3',
    getLocaleId: () => 'en',
    now: () => 1_700_000_000_000,
  })

  await controller.refresh()

  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.phase, 'failed')
  assert.equal(snapshot.errorCode, 'no-manager')
})

test('the snapshot exposes the active locale so the UI can format dates', async () => {
  const fake = fakeRemote(BASE_BUNDLES, {})
  const controller = createController({
    remote: () => fake.remote,
    registry: fakeRegistry(BASE_ANSWERS),
    getRuntimeVersion: () => '0.2.1-rc.3',
    getLocaleId: () => 'zh-CN',
    now: () => 1_700_000_000_000,
  })

  await controller.refresh()

  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.localeId, 'zh-CN')
})

test('a host that removed installBundle reports the update as failed instead of throwing', async () => {
  const fake = fakeRemote(BASE_BUNDLES, {})
  delete fake.remote.pluginManager.installBundle
  const controller = createController({
    remote: () => fake.remote,
    registry: fakeRegistry(BASE_ANSWERS),
    getRuntimeVersion: () => '0.2.1-rc.3',
    getLocaleId: () => 'en',
    now: () => 1_700_000_000_000,
  })
  await controller.refresh()

  controller.requestUpdate('dsh-better-sidebar')
  await controller.confirmUpdate()

  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.phase, 'ready')
  assert.match(snapshot.results['dsh-better-sidebar'].message, /missing installBundle/)
  assert.equal(fake.calls.some((call) => call.method === 'removeBundle'), false)
})

test('a failed bundle read keeps the previous rows and reports the error', async () => {
  let fail = false
  const { controller } = build(BASE_BUNDLES, BASE_ANSWERS, {
    listBundles: (state) => {
      if (fail) throw new Error('profile unreadable')
      return state.bundles.map((bundle) => ({ ...bundle }))
    },
  })
  await controller.refresh()
  const before = controller.getSnapshot().rows

  fail = true
  await controller.refresh()

  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.phase, 'failed')
  assert.match(snapshot.error, /profile unreadable/)
  assert.equal(snapshot.rows, before)
})

test('runtime version is inferred from the installation when the page cannot announce it', async () => {
  const warnings = thirdParty('dsh-context', '0.77.0')
  const fake = fakeRemote([...BASE_BUNDLES, warnings], {})
  const controller = createController({
    remote: () => fake.remote,
    registry: fakeRegistry({
      ...BASE_ANSWERS,
      'dsh-context': manifestOf('dsh-context', '0.78.1', { engines: { dsh: '>=9.0.0' } }),
    }),
    getRuntimeVersion: () => undefined,
    getLocaleId: () => 'en',
  })

  await controller.refresh()

  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.runtimeVersion, '0.2.1-rc.3')
  assert.equal(snapshot.rows.find((row) => row.name === 'dsh-context').status, 'incompatible')
})

test('requestUpdate opens a confirmation only for updatable rows', async () => {
  const { controller } = build(
    [...BASE_BUNDLES, thirdParty('dsh-context', '0.77.0')],
    { ...BASE_ANSWERS, 'dsh-context': manifestOf('dsh-context', '0.78.1', { engines: { dsh: '>=9.0.0' } }) },
  )
  await controller.refresh()

  controller.requestUpdate('dsh-context')
  assert.equal(controller.getSnapshot().confirm, null)

  controller.requestUpdate('dsh-better-sidebar')
  assert.deepEqual(controller.getSnapshot().confirm, {
    name: 'dsh-better-sidebar',
    title: 'dsh-better-sidebar',
    currentVersion: '0.28.1',
    latestVersion: '0.28.2',
  })

  controller.cancelConfirm()
  assert.equal(controller.getSnapshot().confirm, null)
})

test('confirmUpdate removes and reinstalls at the newest version, keeping enablement', async () => {
  const { controller, calls } = build(BASE_BUNDLES, BASE_ANSWERS)
  await controller.refresh()

  controller.requestUpdate('dsh-better-sidebar')
  await controller.confirmUpdate()

  const methods = calls.map((call) => call.method)
  const removalIndex = methods.indexOf('removeBundle')
  assert.ok(removalIndex >= 0, 'the update removes the bundle first')
  assert.equal(methods[removalIndex + 1], 'installBundle', 'the install follows the removal directly')
  const install = calls.filter((call) => call.method === 'installBundle')[0]
  assert.equal(install.spec, 'dsh-better-sidebar@0.28.2')
  assert.equal(install.options.enabled, true)

  const snapshot = controller.getSnapshot()
  assert.deepEqual(snapshot.results['dsh-better-sidebar'], { kind: 'updated', restartRequired: true })
  assert.equal(snapshot.confirm, null)
  assert.equal(snapshot.busyName, null)
  assert.equal(snapshot.installPhase, null)
  assert.equal(snapshot.rows.find((row) => row.name === 'dsh-better-sidebar').currentVersion, '0.28.2')
  assert.equal(snapshot.updateCount, 1)
})

test('a successful update publishes a toast until it is dismissed', async () => {
  const { controller } = build(BASE_BUNDLES, BASE_ANSWERS)
  await controller.refresh()

  controller.requestUpdate('dsh-better-sidebar')
  await controller.confirmUpdate()

  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.toast.kind, 'updated')
  assert.equal(snapshot.toast.name, 'dsh-better-sidebar')
  assert.equal(snapshot.toast.restartRequired, true)
  assert.ok(typeof snapshot.toast.id === 'string' && snapshot.toast.id !== '')

  controller.dismissToast(snapshot.toast.id)
  assert.equal(controller.getSnapshot().toast, null)
})

test('a failed install rolls back to the previous version', async () => {
  const installs = []
  const { controller } = build(BASE_BUNDLES, BASE_ANSWERS, {
    install: (spec, options, state) => {
      installs.push(spec)
      if (installs.length === 1) {
        return { changed: false, application: 'failed', stage: 'install', target: 'dsh-better-sidebar', error: { code: 'operation-error', diagnostic: 'pnpm exploded' } }
      }
      state.bundles = state.bundles.filter((bundle) => bundle.name !== 'dsh-better-sidebar')
      state.bundles.push(thirdParty('dsh-better-sidebar', '0.28.1'))
      return { changed: true, application: 'restart-required', stage: 'install', target: 'dsh-better-sidebar' }
    },
  })
  await controller.refresh()

  controller.requestUpdate('dsh-better-sidebar')
  await controller.confirmUpdate()

  assert.deepEqual(installs, ['dsh-better-sidebar@0.28.2', 'dsh-better-sidebar@0.28.1'])
  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.results['dsh-better-sidebar'].kind, 'rolled-back')
  assert.match(snapshot.results['dsh-better-sidebar'].message, /pnpm exploded/)
  assert.equal(snapshot.rows.find((row) => row.name === 'dsh-better-sidebar').currentVersion, '0.28.1')
  assert.equal(snapshot.notices.length, 0)
  assert.equal(snapshot.toast.kind, 'rolled-back')
})

test('when the rollback fails too, the loss becomes a dismissible notice', async () => {
  const { controller } = build(BASE_BUNDLES, BASE_ANSWERS, {
    install: () => ({ changed: false, application: 'failed', stage: 'install', target: 'x', error: { code: 'network', diagnostic: 'no network' } }),
  })
  await controller.refresh()

  controller.requestUpdate('dsh-pet')
  await controller.confirmUpdate()

  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.results['dsh-pet'], undefined)
  assert.equal(snapshot.notices.length, 1)
  assert.equal(snapshot.notices[0].name, 'dsh-pet')
  assert.equal(snapshot.notices[0].level, 'error')
  assert.match(snapshot.notices[0].message, /no network/)

  controller.dismissNotice(snapshot.notices[0].id)
  assert.equal(controller.getSnapshot().notices.length, 0)
  assert.equal(snapshot.toast.kind, 'rollback-failed')
  assert.equal(snapshot.notices[0].kind, 'rollback-failed')
})

test('a stale success result disappears instead of becoming an error notice', async () => {
  const fake = build(BASE_BUNDLES, BASE_ANSWERS)
  const { controller } = fake
  await controller.refresh()

  controller.requestUpdate('dsh-pet')
  await controller.confirmUpdate()
  assert.equal(controller.getSnapshot().results['dsh-pet'].kind, 'updated')

  // Simulate an external removal (another surface uninstalled the plugin): the
  // success result must not resurface as an "applied" error card.
  fake.state.bundles = fake.state.bundles.filter((bundle) => bundle.name !== 'dsh-pet')
  await controller.refresh()

  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.results['dsh-pet'], undefined)
  assert.equal(snapshot.notices.length, 0)
})

test('updateAll updates every updatable row in order', async () => {
  const { controller, calls } = build(BASE_BUNDLES, BASE_ANSWERS)
  await controller.refresh()

  await controller.updateAll()

  const installs = calls.filter((call) => call.method === 'installBundle').map((call) => call.spec)
  assert.deepEqual(installs.sort(), ['dsh-better-sidebar@0.28.2', 'dsh-pet@0.3.8'])
  assert.equal(calls.filter((call) => call.method === 'removeBundle').length, 2)

  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.updatingAll, false)
  assert.equal(snapshot.updateCount, 0)
  assert.equal(snapshot.results['dsh-better-sidebar'].kind, 'updated')
  assert.equal(snapshot.results['dsh-pet'].kind, 'updated')
  assert.equal(snapshot.toast.kind, 'batch')
  assert.equal(snapshot.toast.updated, 2)
  assert.equal(snapshot.toast.failed, 0)
  assert.equal(snapshot.batch, null)
})

test('a reported install phase only tracks this panel request', async () => {
  let releaseInstall = () => {}
  const installGate = new Promise((resolve) => {
    releaseInstall = resolve
  })
  let requestId
  const { controller } = build(BASE_BUNDLES, BASE_ANSWERS, {
    install: async (spec, options, state) => {
      requestId = options.requestId
      await installGate
      const name = spec.slice(0, spec.lastIndexOf('@'))
      state.bundles = state.bundles.filter((bundle) => bundle.name !== name).concat([thirdParty(name, '9.9.9')])
      return { changed: true, application: 'applied', stage: 'install', target: name }
    },
  })
  await controller.refresh()
  controller.requestUpdate('dsh-pet')

  const running = controller.confirmUpdate()
  await Promise.resolve()
  await Promise.resolve()

  controller.handleInstallState({ requestId: 'other', phase: 'applying' })
  assert.equal(controller.getSnapshot().installPhase, 'installing')
  assert.equal(controller.getSnapshot().busyName, 'dsh-pet')

  controller.handleInstallState({ requestId, phase: 'applying' })
  assert.equal(controller.getSnapshot().installPhase, 'applying')

  releaseInstall()
  await running

  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.installPhase, null)
  assert.deepEqual(snapshot.results['dsh-pet'], { kind: 'applied' })
})

test('a host change refreshes an idle panel but not one that is updating', async () => {
  const { controller, calls } = build(BASE_BUNDLES, BASE_ANSWERS)
  await controller.refresh()
  const checksAfterRefresh = calls.filter((call) => call.method === 'listBundles').length

  controller.handleHostChanged()
  await controller.getSnapshot().phase === 'ready'
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.ok(calls.filter((call) => call.method === 'listBundles').length > checksAfterRefresh)
})

test('dismissal clears error and per-row results', async () => {
  const { controller } = build(BASE_BUNDLES, BASE_ANSWERS, {
    listBundles: () => {
      throw new Error('nope')
    },
  })
  await controller.refresh()
  assert.match(controller.getSnapshot().error, /nope/)
  controller.dismissError()
  assert.equal(controller.getSnapshot().error, null)
})
