/**
 * Host half of dsh-plugin-updates.
 *
 * The panel itself lives in the browser half (`lib/client.js`): it reads the
 * running profile's bundles through the official plugin manager's Remote
 * methods and performs updates there. This row owns the one thing the browser
 * cannot do — reading the other DSH profiles from disk — and exposes the result
 * as a small read-only JSON route on the already-running web server:
 *
 *   GET /plugin-updates/profiles
 *   { "profiles": [ { "name": "desktop", "plugins": [ { "name", "version", "source" } ] } ] }
 *
 * It never writes to a profile, never installs or removes anything, and the
 * payload contains only profile names plus third-party package names/versions
 * (no filesystem paths, credentials or session data). The client half uses it
 * for a read-only "other profiles" section; updating those profiles stays a
 * deliberate action outside this plugin.
 */
import { readdir, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/** Route the browser half fetches. */
export const PROFILES_ROUTE = '/plugin-updates/profiles'

/** This bundle's own package name; never listed inside the overview. */
export const SELF_NAME = '@moyumole/dsh-plugin-updates'

/** Official DSH bundles are not third-party updates. */
const OFFICIAL_PREFIX = '@deepseek-ai/'

/**
 * Read one profile's third-party dependencies and their installed versions.
 * @param {string} profileDir absolute profile directory
 * @returns {Promise<Array<{name: string, version: string|null, source: string}>|null>}
 *   null when the directory has no readable package.json (not a profile)
 */
async function readProfilePlugins(profileDir) {
  let manifest
  try {
    manifest = JSON.parse(await readFile(path.join(profileDir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
  const dependencies =
    manifest !== null && typeof manifest === 'object' && manifest.dependencies !== null
      && typeof manifest.dependencies === 'object'
      ? manifest.dependencies
      : {}
  const plugins = []
  for (const [name, source] of Object.entries(dependencies)) {
    if (typeof name !== 'string' || name === '' || name === SELF_NAME) continue
    if (name.startsWith(OFFICIAL_PREFIX)) continue
    if (typeof source !== 'string') continue
    plugins.push({ name, version: await readInstalledVersion(profileDir, name), source })
  }
  plugins.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  return plugins
}

/**
 * The version recorded in a profile's node_modules, or null when it is missing.
 * @param {string} profileDir
 * @param {string} name npm package name
 * @returns {Promise<string|null>}
 */
async function readInstalledVersion(profileDir, name) {
  try {
    const packageFile = path.join(profileDir, 'node_modules', ...name.split('/'), 'package.json')
    const installed = JSON.parse(await readFile(packageFile, 'utf8'))
    return typeof installed.version === 'string' && installed.version !== '' ? installed.version : null
  } catch {
    return null
  }
}

/**
 * Scan every profile directory under `<DSH_HOME>/profiles`.
 * Read-only and side-effect free; exported for tests.
 * @param {string} home DSH home (`DSH_HOME`); profiles live in `home/profiles`
 * @returns {Promise<{profiles: Array<{name: string, plugins: Array<object>}>}>}
 */
export async function scanProfiles(home) {
  const profilesDir = path.join(home, 'profiles')
  let entries
  try {
    entries = await readdir(profilesDir, { withFileTypes: true })
  } catch {
    return { profiles: [] }
  }
  const profiles = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const plugins = await readProfilePlugins(path.join(profilesDir, entry.name))
    if (plugins === null) continue
    profiles.push({ name: entry.name, plugins })
  }
  profiles.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  return { profiles }
}

/**
 * Serve the profile inventory as JSON.
 * @param {string} home DSH home
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function serveProfiles(home, req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('allow', 'GET')
    res.end('method not allowed')
    return
  }
  try {
    const scanned = await scanProfiles(home)
    // The panel already covers the running profile; only profiles that actually
    // carry third-party plugins are interesting for the read-only overview.
    const profiles = scanned.profiles.filter((profile) => profile.plugins.length > 0)
    const payload = { currentProfile: currentProfileName(home), profiles }
    res.statusCode = 200
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.end(JSON.stringify(payload))
  } catch (error) {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.end(JSON.stringify({ currentProfile: null, profiles: [], error: error instanceof Error ? error.message : 'scan failed' }))
  }
}

/** DSH home: the same `DSH_HOME` the running app uses, with a portable fallback. */
function dshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv !== '') return fromEnv
  return path.join(os.homedir(), '.dsh')
}

/**
 * The profile this Host process was started with. The desktop host receives the
 * profile directory as a positional argument; matching it against `<home>/profiles`
 * avoids parsing any other launch detail.
 * @param {string} home
 * @returns {string|null}
 */
export function currentProfileName(home) {
  const profilesDir = path.resolve(home, 'profiles')
  for (const arg of process.argv) {
    if (typeof arg !== 'string' || arg === '') continue
    try {
      const resolved = path.resolve(arg)
      if (path.dirname(resolved) === profilesDir) return path.basename(resolved)
    } catch {
      // Unresolvable argv entries are irrelevant here.
    }
  }
  return null
}

/**
 * Mount the read-only profile route next to the panel.
 * @param {object} ctx Cordis host context
 */
export function apply(ctx) {
  ctx.effect(() => {
    let disposeRoute
    let disposeInject = () => {}
    try {
      disposeInject = ctx.inject(['webServer'], (injected) => {
        const webServer = injected.get('webServer')
        if (webServer === undefined || webServer === null || typeof webServer.register !== 'function') return undefined
        disposeRoute = webServer.register({
          kind: 'exact',
          path: PROFILES_ROUTE,
          handler: (req, res) => serveProfiles(dshHome(), req, res),
        })
        return disposeRoute
      })
    } catch {
      disposeInject = () => {}
    }
    return () => {
      if (typeof disposeInject === 'function') disposeInject()
      if (typeof disposeRoute === 'function') disposeRoute()
    }
  }, 'dsh-plugin-updates: read-only profile route')
}
