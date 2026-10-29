/**
 * npm registry `latest` manifest lookup with an in-memory cache.
 *
 * Responsibilities: fetch `https://<registry>/<name>/latest` in the browser,
 * trying the official npm registry first and the npmmirror mirror second, and
 * cache successful answers for `ttlMs` (default 10 minutes). Failures are never
 * cached, so a retry always hits the network again.
 *
 * Key semantics:
 * - scoped names encode the slash: `@scope/name` -> `@scope%2Fname`;
 * - registries are tried in order; all attempts failing returns the last error;
 * - `fetchImpl`, `now` and `timeoutMs` are injectable so this stays pure logic
 *   and unit-testable without the network or real time;
 * - timeout uses `AbortSignal.timeout` plus an abort race, never a timer
 *   primitive (this module must stay timer-free); when the platform lacks
 *   `AbortSignal.timeout` the lookup simply runs without a deadline;
 * - error strings are short and readable: `HTTP 404`, `network error`,
 *   `timeout`, `invalid JSON`, `missing version`, `invalid name`, `aborted`.
 *
 * Pure logic only: no DOM, no timers, no Node built-ins.
 */

const registryDefaultRegistries = [
  'https://registry.npmjs.org/',
  'https://registry.npmmirror.com/',
]
const registryDefaultTtlMs = 600000
const registryDefaultTimeoutMs = 8000
/** Largest `/latest` document accepted; a compromised registry cannot make the page allocate unbounded memory. */
const registryMaxManifestBytes = 2000000
/** The npm package-name grammar the registry accepts as a URL path segment. */
const registryPackageName = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/
const registryPackageNameMaxLength = 214

/** Whether a bundle name is safe to interpolate into a registry URL. */
function registryValidName(name) {
  return name.length > 0
    && name.length <= registryPackageNameMaxLength
    && registryPackageName.test(name)
}

function registryEncodeName(name) {
  if (name.startsWith('@')) {
    const slash = name.indexOf('/')
    return '@' + encodeURIComponent(name.slice(1, slash)) + '%2F' + encodeURIComponent(name.slice(slash + 1))
  }
  return encodeURIComponent(name)
}

function registryNormalizeBase(base) {
  return base.endsWith('/') ? base : base + '/'
}

function registryBuildUrl(base, name) {
  return registryNormalizeBase(base) + registryEncodeName(name) + '/latest'
}

function registryFetchError(message) {
  const error = new Error(message)
  error.registryError = message
  return error
}

function registryAbortError(kind) {
  const error = new Error(kind)
  error.registryAbort = kind
  return error
}

function registryCreateSignals(callerSignal, timeoutMs) {
  let timeoutSignal = null
  if (
    timeoutMs > 0
    && typeof AbortSignal !== 'undefined'
    && typeof AbortSignal.timeout === 'function'
  ) {
    timeoutSignal = AbortSignal.timeout(timeoutMs)
  }
  let signal = callerSignal || null
  if (timeoutSignal) {
    if (!signal) {
      signal = timeoutSignal
    } else if (typeof AbortSignal.any === 'function') {
      signal = AbortSignal.any([signal, timeoutSignal])
    } else {
      const controller = new AbortController()
      const abort = () => controller.abort()
      if (signal.aborted || timeoutSignal.aborted) {
        controller.abort()
      } else {
        signal.addEventListener('abort', abort, { once: true })
        timeoutSignal.addEventListener('abort', abort, { once: true })
      }
      signal = controller.signal
    }
  }
  return { signal, timeoutSignal, callerSignal }
}

function registryAbortRace(callerSignal, timeoutSignal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(registryAbortError(callerSignal && callerSignal.aborted ? 'aborted' : 'timeout'))
    }
    if (callerSignal && callerSignal.aborted) {
      onAbort()
      return
    }
    if (timeoutSignal && timeoutSignal.aborted) {
      onAbort()
      return
    }
    if (callerSignal) callerSignal.addEventListener('abort', onAbort, { once: true })
    if (timeoutSignal) timeoutSignal.addEventListener('abort', onAbort, { once: true })
  })
}

async function registryReadManifest(response) {
  if (!response || typeof response !== 'object') throw registryFetchError('network error')
  const status = typeof response.status === 'number'
    ? response.status
    : (response.ok === false ? 0 : 200)
  if (response.ok === false || status < 200 || status >= 300) {
    throw registryFetchError('HTTP ' + status)
  }
  const headers = response.headers
  if (headers && typeof headers.get === 'function') {
    const declared = Number(headers.get('content-length'))
    if (Number.isFinite(declared) && declared > registryMaxManifestBytes) {
      throw registryFetchError('response too large')
    }
  }
  let manifest
  try {
    manifest = await response.json()
  } catch {
    throw registryFetchError('invalid JSON')
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw registryFetchError('invalid JSON')
  }
  if (typeof manifest.version !== 'string' || manifest.version.trim() === '') {
    throw registryFetchError('missing version')
  }
  return manifest
}

/**
 * Create a registry client.
 *
 * @param {object} [options]
 * @param {Function} [options.fetchImpl] fetch-compatible function (defaults to global fetch)
 * @param {Function} [options.now] clock in ms (defaults to Date.now)
 * @param {number} [options.ttlMs=600000] success cache ttl
 * @param {string[]} [options.registries] registry base URLs, tried in order
 * @param {number} [options.timeoutMs=8000] per-attempt deadline (0 disables)
 * @returns {{
 *   latestManifest: (name:string, lookupOptions?:{signal?:AbortSignal}) => Promise<
 *     {ok:true, manifest:object, registry:string} | {ok:false, error:string, registry?:string}>,
 *   clear: () => void,
 *   size: () => number,
 * }}
 */
export function createRegistry(options) {
  const settings = options || {}
  const fetchImpl = typeof settings.fetchImpl === 'function'
    ? settings.fetchImpl
    : (typeof fetch === 'function' ? (input, init) => fetch(input, init) : null)
  const now = typeof settings.now === 'function' ? settings.now : () => Date.now()
  const ttlMs = typeof settings.ttlMs === 'number' ? settings.ttlMs : registryDefaultTtlMs
  const timeoutMs = typeof settings.timeoutMs === 'number'
    ? settings.timeoutMs
    : registryDefaultTimeoutMs
  const registries = Array.isArray(settings.registries) && settings.registries.length > 0
    ? settings.registries.map(registryNormalizeBase)
    : registryDefaultRegistries.map(registryNormalizeBase)
  const cache = new Map()

  async function latestManifest(name, lookupOptions) {
    const callerSignal = lookupOptions && lookupOptions.signal ? lookupOptions.signal : undefined
    if (typeof name !== 'string') return { ok: false, error: 'invalid name' }
    const packageName = name.trim()
    if (!registryValidName(packageName)) return { ok: false, error: 'invalid name' }
    const cached = cache.get(packageName)
    if (cached && now() - cached.fetchedAt < ttlMs) {
      return { ok: true, manifest: cached.manifest, registry: cached.registry }
    }
    if (!fetchImpl) return { ok: false, error: 'fetch unavailable', registry: registries[0] }
    if (callerSignal && callerSignal.aborted) return { ok: false, error: 'aborted' }

    let lastError = 'network error'
    let lastRegistry = registries[registries.length - 1]
    for (const base of registries) {
      lastRegistry = base
      if (callerSignal && callerSignal.aborted) {
        return { ok: false, error: 'aborted', registry: base }
      }
      const signals = registryCreateSignals(callerSignal, timeoutMs)
      try {
        const request = Promise.resolve().then(() => fetchImpl(
          registryBuildUrl(base, packageName),
          { signal: signals.signal, headers: { accept: 'application/json' } },
        ))
        const response = signals.signal
          ? await Promise.race([
            request,
            registryAbortRace(signals.callerSignal, signals.timeoutSignal),
          ])
          : await request
        const manifest = await registryReadManifest(response)
        cache.set(packageName, { manifest, registry: base, fetchedAt: now() })
        return { ok: true, manifest, registry: base }
      } catch (error) {
        if (error && error.registryAbort) {
          lastError = error.registryAbort
          if (error.registryAbort === 'aborted') {
            return { ok: false, error: 'aborted', registry: base }
          }
        } else if (error && error.registryError) {
          lastError = error.registryError
        } else if (signals.callerSignal && signals.callerSignal.aborted) {
          return { ok: false, error: 'aborted', registry: base }
        } else if (signals.timeoutSignal && signals.timeoutSignal.aborted) {
          lastError = 'timeout'
        } else {
          lastError = 'network error'
        }
      }
    }
    return { ok: false, error: lastError, registry: lastRegistry }
  }

  return {
    latestManifest,
    clear() {
      cache.clear()
    },
    size() {
      return cache.size
    },
  }
}
