/**
 * Update panel state machine.
 *
 * Owns the panel snapshot the two seats render and drives the official plugin
 * manager's Remote methods: read installed bundles, look their newest versions
 * up in the registry, and update one bundle at a time by removing it and
 * installing the newest version, rolling back to the previous version when that
 * install fails.
 *
 * The controller is deliberately free of Cordis, React, and DOM access: the
 * entry wires it to the live services and the UI only reads snapshots.
 */
import { STATUS, buildRows, isRegistrySource, isThirdPartyBundle } from './rows.js'

/** Registry answers remembered by the row builder; failures stay per row. */
function controllerErrorText(error) {
  if (error === undefined || error === null) return 'unknown error'
  if (typeof error === 'string') return error
  if (typeof error.message === 'string' && error.message !== '') return error.message
  return String(error)
}

/** A readable sentence for a failed `ChangeResult`, preferring the Host's diagnostic. */
function controllerChangeError(result) {
  if (result === undefined || result === null) return 'no result'
  const error = result.error
  if (error !== undefined) {
    if (typeof error.diagnostic === 'string' && error.diagnostic !== '') return error.diagnostic
    if (typeof error.code === 'string' && error.code !== '') return error.code
  }
  const packageResult = result.packageResult
  if (packageResult !== undefined && typeof packageResult.output === 'string') {
    const output = packageResult.output.trim()
    if (output !== '') {
      const lines = output.split(/\r?\n/)
      const tail = lines.slice(-8).join('\n')
      return tail.length > 800 ? `…${tail.slice(-800)}` : tail
    }
  }
  return typeof result.application === 'string' ? result.application : 'unknown error'
}

/** Whether a `ChangeResult` reports a completed step. */
function controllerSucceeded(result) {
  if (result === undefined || result === null) return false
  return result.application === 'applied' || result.application === 'restart-required'
}

/**
 * Unwrap one Client Remote answer.
 *
 * The API gateway's generated methods resolve to `RemoteResult`
 * (`{ ok: true, value }` / `{ ok: false, error }`); HTTP-layer or denied calls
 * therefore never look like data. A failed result throws the remote failure so
 * the caller's own `catch` reports it like a transport error.
 */
function controllerRemoteValue(result, what) {
  if (result === undefined || result === null || typeof result !== 'object' || !('ok' in result)) {
    return result
  }
  if (result.ok === true) return result.value
  const failure = result.error
  const message = failure !== undefined && failure !== null && typeof failure.message === 'string' && failure.message !== ''
    ? failure.message
    : 'remote call failed'
  const error = new Error(`${what} failed: ${message}`)
  if (failure !== undefined && failure !== null && typeof failure.code === 'string') error.code = failure.code
  throw error
}

/** The version a profile-installed bundle reports, when readable. */
function controllerVersionOf(bundle) {
  return bundle !== undefined && typeof bundle.version === 'string' ? bundle.version : null
}

/**
 * Create the update panel controller.
 * @param {object} deps
 * @param {() => object | undefined} deps.remote - returns the client `remote` service when available.
 * @param {{ latestManifest: (name: string) => Promise<object> }} deps.registry - registry reader (created by entry).
 * @param {() => string | undefined} [deps.getRuntimeVersion] - the running dsh version, when the page can announce it.
 * @param {() => string} [deps.getLocaleId] - active locale id, for localized bundle titles.
 * @param {string} [deps.selfName] - this package, excluded from its own update list.
 * @param {() => number} [deps.now] - clock override.
 * @returns {object} the controller.
 */
export function createController(deps) {
  const remoteOf = deps.remote
  const registry = deps.registry
  const getRuntimeVersion = deps.getRuntimeVersion ?? (() => undefined)
  const getLocaleId = deps.getLocaleId ?? (() => 'en')
  const selfName = deps.selfName ?? '@moyumole/dsh-plugin-updates'
  const now = deps.now ?? (() => Date.now())

  const listeners = new Set()
  let disposed = false
  let inflight = null
  let busyName = null
  let currentRequestId = null
  let noticeSeq = 0
  let toastSeq = 0

  /** The published snapshot; replaced only when something changed. */
  let state = {
    phase: 'idle',
    lastCheckedAt: null,
    runtimeVersion: null,
    error: null,
    rows: [],
    results: {},
    confirm: null,
    updatingAll: false,
    busyName: null,
    updateCount: 0,
    installPhase: null,
    batch: null,
    toast: null,
    notices: [],
  }

  /** Publish the next snapshot, deriving the counters the UI binds to. */
  function emit(patch) {
    const next = { ...state, ...patch }
    if (patch.rows !== undefined) {
      next.updateCount = next.rows.filter((row) => row.status === STATUS.update).length
    }
    if (next.busyName === undefined) next.busyName = busyName
    state = next
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch (error) {
        console.error('[dsh-plugin-updates] snapshot listener failed:', error)
      }
    }
  }

  /** The Remote namespace, or a readable failure. */
  function pluginManager() {
    const remote = remoteOf()
    if (remote === undefined || remote === null) {
      const error = new Error('the plugin manager Remote service is unavailable')
      error.code = 'no-remote'
      throw error
    }
    const manager = remote.pluginManager
    if (manager === undefined || manager === null) {
      const error = new Error('the plugin manager Remote namespace is unavailable')
      error.code = 'no-remote'
      throw error
    }
    return manager
  }

  /** A version the page itself cannot announce is read off the installation bundles. */
  function inferRuntimeVersion(bundles) {
    const base = bundles.find((bundle) => bundle.name === '@deepseek-ai/dsh-base')
    const baseVersion = controllerVersionOf(base)
    if (baseVersion !== null) return baseVersion
    for (const bundle of bundles) {
      if (bundle.official === true) {
        const version = controllerVersionOf(bundle)
        if (version !== null) return version
      }
    }
    return null
  }

  /** Replace one row's trailing result. */
  function setResult(name, result) {
    emit({ results: { ...state.results, [name]: result } })
  }

  /**
   * Publish one update outcome: the row result plus the toast that tells the
   * reader it happened. The toast is skipped for the members of a batch, whose
   * single summary toast is published by `updateAll`.
   * @param {string} name - bundle name.
   * @param {object} result - row result `{ kind, message?, restartRequired? }`.
   * @param {{ silent?: boolean }} options - batch members pass `silent: true`.
   */
  function publishOutcome(name, result, options) {
    setResult(name, result)
    if (options !== undefined && options.silent === true) return
    const tone =
      result.kind === 'updated' || result.kind === 'applied'
        ? 'success'
        : result.kind === 'rolled-back'
          ? 'warn'
          : 'error'
    emit({
      toast: {
        id: `toast-${++toastSeq}`,
        kind: result.kind,
        tone,
        name,
        message: result.message,
        restartRequired: result.restartRequired === true,
      },
    })
  }

  /** Drop one row's trailing result. */
  function clearResult(name) {
    if (state.results[name] === undefined) return
    const results = { ...state.results }
    delete results[name]
    emit({ results })
  }

  /**
   * Keep failure results whose row disappeared visible as notices.
   *
   * Only failures become notices: a success result whose row is briefly absent
   * (a removal/refresh race, or an external install/remove) would otherwise turn
   * into a misleading "error" card whose text is the raw internal kind. The
   * bundle currently being updated is left alone so its result survives until
   * that operation settles.
   */
  function adoptOrphanResults() {
    const orphaned = Object.keys(state.results).filter(
      (name) => name !== busyName && !state.rows.some((row) => row.name === name),
    )
    if (orphaned.length === 0) return
    const results = { ...state.results }
    const notices = [...state.notices]
    for (const name of orphaned) {
      const result = results[name]
      delete results[name]
      if (result.kind === 'updated' || result.kind === 'applied') continue
      notices.push({
        id: `notice-${++noticeSeq}`,
        name,
        level: result.kind === 'rolled-back' ? 'warn' : 'error',
        kind: result.kind,
        message: typeof result.message === 'string' ? result.message : '',
      })
    }
    emit({ results, notices })
  }

  /** Load bundles and registry answers, then publish a fresh row list. */
  async function refresh() {
    if (disposed) return
    if (inflight !== null) return inflight
    inflight = (async () => {
      emit({ phase: 'checking', error: null })
      try {
        const manager = pluginManager()
        const bundles = controllerRemoteValue(await manager.listBundles(), 'listBundles')
        if (disposed) return
        const runtimeVersion = getRuntimeVersion() ?? state.runtimeVersion ?? inferRuntimeVersion(bundles)
        const candidates = (Array.isArray(bundles) ? bundles : []).filter((bundle) =>
          isThirdPartyBundle(bundle, selfName),
        )
        const manifests = {}
        const errors = {}
        await Promise.all(
          candidates.map(async (bundle) => {
            if (!isRegistrySource(bundle.source, bundle.name)) return
            let answer
            try {
              answer = await registry.latestManifest(bundle.name)
            } catch (error) {
              errors[bundle.name] = controllerErrorText(error)
              return
            }
            if (disposed) return
            if (answer !== undefined && answer.ok === true && answer.manifest !== undefined) {
              manifests[bundle.name] = answer.manifest
            } else {
              errors[bundle.name] = answer !== undefined && typeof answer.error === 'string'
                ? answer.error
                : 'no answer'
            }
          }),
        )
        if (disposed) return
        const built = buildRows({
          bundles: Array.isArray(bundles) ? bundles : [],
          manifests,
          errors,
          localeId: getLocaleId(),
          runtimeVersion,
          selfName,
        })
        emit({
          phase: 'ready',
          runtimeVersion: runtimeVersion ?? null,
          rows: built.rows,
          lastCheckedAt: now(),
        })
        adoptOrphanResults()
      } catch (error) {
        if (disposed) return
        emit({ phase: 'failed', error: controllerErrorText(error) })
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  /** Remove one bundle, install the newest version, roll back when that fails. */
  async function runUpdate(entry, options) {
    const name = entry.name
    const opts = options === undefined ? {} : options
    busyName = name
    clearResult(name)
    emit({ busyName, installPhase: 'removing', confirm: null, toast: null })
    try {
      const manager = pluginManager()
      const bundles = controllerRemoteValue(await manager.listBundles(), 'listBundles')
      if (disposed) return
      const before = (Array.isArray(bundles) ? bundles : []).find((bundle) => bundle.name === name)
      const previousVersion = controllerVersionOf(before) ?? entry.currentVersion ?? null
      const enabled = before !== undefined ? before.enabled !== false : true

      let removal
      try {
        removal = controllerRemoteValue(await manager.removeBundle(name), 'removeBundle')
      } catch (error) {
        publishOutcome(name, { kind: 'failed', message: controllerErrorText(error) }, opts)
        return
      }
      if (disposed) return
      if (!controllerSucceeded(removal) && removal !== undefined && removal.changed === true && removal.application === undefined) {
        // Some removals report only `changed: true`; treat that as success.
      } else if (!controllerSucceeded(removal)) {
        publishOutcome(name, { kind: 'failed', message: controllerChangeError(removal) }, opts)
        return
      }

      currentRequestId = `plugin-updates-${now()}-${Math.random().toString(36).slice(2, 10)}`
      emit({ installPhase: 'installing' })
      let install
      try {
        install = controllerRemoteValue(await manager.installBundle(`${name}@${entry.latestVersion}`, {
          enabled,
          requestId: currentRequestId,
        }), 'installBundle')
      } catch (error) {
        install = { changed: false, application: 'failed', stage: 'install', target: name, error: { diagnostic: controllerErrorText(error) } }
      }
      if (disposed) return

      if (controllerSucceeded(install)) {
        const applied = install.application === 'applied'
        publishOutcome(name, {
          kind: applied ? 'applied' : 'updated',
          ...(applied ? {} : { restartRequired: true }),
        }, opts)
        return
      }

      const failure = controllerChangeError(install)
      let rollback
      emit({ installPhase: 'rolling-back' })
      if (previousVersion === null) {
        publishOutcome(name, { kind: 'rollback-failed', message: failure }, opts)
        return
      }
      try {
        rollback = controllerRemoteValue(await manager.installBundle(`${name}@${previousVersion}`, {
          enabled,
          requestId: `plugin-updates-${now()}-${Math.random().toString(36).slice(2, 10)}`,
        }), 'installBundle')
      } catch (error) {
        rollback = { changed: false, application: 'failed', stage: 'install', target: name, error: { diagnostic: controllerErrorText(error) } }
      }
      if (disposed) return
      if (controllerSucceeded(rollback)) {
        publishOutcome(name, { kind: 'rolled-back', message: failure }, opts)
      } else {
        publishOutcome(name, {
          kind: 'rollback-failed',
          message: `${failure} / ${controllerChangeError(rollback)}`,
        }, opts)
      }
    } catch (error) {
      if (!disposed) publishOutcome(name, { kind: 'failed', message: controllerErrorText(error) }, opts)
    } finally {
      currentRequestId = null
      busyName = null
      emit({ busyName: null, installPhase: null })
      await refresh()
    }
  }

  return {
    getSnapshot() {
      return state
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    dispose() {
      disposed = true
      listeners.clear()
    },

    refresh,

    /** Ask for confirmation before updating one bundle. */
    requestUpdate(name) {
      const row = state.rows.find((entry) => entry.name === name)
      if (row === undefined || row.status !== STATUS.update || busyName !== null || state.updatingAll) return
      emit({
        confirm: {
          name: row.name,
          title: row.title,
          currentVersion: row.currentVersion,
          latestVersion: row.latestVersion,
        },
      })
    },

    /** Drop a pending confirmation. */
    cancelConfirm() {
      if (state.confirm !== null) emit({ confirm: null })
    },

    /** Execute the pending confirmation. */
    async confirmUpdate() {
      const confirm = state.confirm
      if (confirm === null) return
      if (busyName !== null || state.updatingAll) return
      const row = state.rows.find((entry) => entry.name === confirm.name)
      if (row === undefined || row.status !== STATUS.update) {
        emit({ confirm: null })
        return
      }
      await runUpdate({
        name: row.name,
        currentVersion: row.currentVersion,
        latestVersion: row.latestVersion,
      })
    },

    /** Update every updatable bundle, one at a time. */
    async updateAll() {
      if (busyName !== null || state.updatingAll) return
      const names = state.rows.filter((row) => row.status === STATUS.update).map((row) => row.name)
      if (names.length === 0) return
      let updated = 0
      let failed = 0
      emit({ updatingAll: true, confirm: null, batch: { total: names.length, done: 0 } })
      try {
        for (const name of names) {
          if (disposed) return
          const row = state.rows.find((entry) => entry.name === name)
          if (row !== undefined && row.status === STATUS.update) {
            await runUpdate({
              name: row.name,
              currentVersion: row.currentVersion,
              latestVersion: row.latestVersion,
            }, { silent: true })
            const result = state.results[name]
            if (result !== undefined && (result.kind === 'updated' || result.kind === 'applied')) updated += 1
            else failed += 1
          }
          const done = state.batch === null ? 0 : state.batch.done
          emit({ batch: { total: names.length, done: Math.min(done + 1, names.length) } })
        }
      } finally {
        if (!disposed) {
          emit({
            updatingAll: false,
            batch: null,
            toast: {
              id: `toast-${++toastSeq}`,
              kind: 'batch',
              tone: failed === 0 ? 'success' : updated === 0 ? 'error' : 'warn',
              name: null,
              updated,
              failed,
            },
          })
        }
      }
    },

    /** Dismiss the toast published by the last update. */
    dismissToast(id) {
      if (state.toast === null || state.toast.id !== id) return
      emit({ toast: null })
    },

    /** Dismiss one row's trailing result. */
    dismissResult(name) {
      clearResult(name)
    },

    /** Dismiss one notice created for a result whose row disappeared. */
    dismissNotice(id) {
      if (!state.notices.some((notice) => notice.id === id)) return
      emit({ notices: state.notices.filter((notice) => notice.id !== id) })
    },

    /** Dismiss the panel-level failure. */
    dismissError() {
      if (state.error !== null) emit({ error: null })
    },

    /** Refresh after another surface changed the profile, unless work is in flight. */
    handleHostChanged() {
      if (disposed || busyName !== null || state.updatingAll) return
      if (state.phase === 'checking') return
      void refresh()
    },

    /** Follow the Host's install progress for this panel's own request. */
    handleInstallState(frame) {
      if (frame === undefined || frame === null) return
      if (currentRequestId === null || frame.requestId !== currentRequestId) return
      if (typeof frame.phase !== 'string') return
      emit({ installPhase: frame.phase })
    },
  }
}
