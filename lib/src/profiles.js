/**
 * Read-only "other profiles" overview.
 *
 * The Host half serves `GET /plugin-updates/profiles` with each profile's
 * third-party dependencies and installed versions. This module turns that
 * inventory into the same row shape the main panel uses (via `buildRows`), so
 * the overview gets identical status logic (update / incompatible / failed /
 * unsupported / latest) without duplicating it.
 *
 * Pure logic: no DOM, timers, or Node built-ins.
 */
import { buildRows } from './rows.js'

/** Route served by the host half. */
export const PROFILES_ROUTE = '/plugin-updates/profiles'

/**
 * Normalize a dependency spec into the `name@spec` form `isRegistrySource`
 * understands. Non-registry sources (`link:`, `file:`, git, …) stay as-is so the
 * row is marked unsupported instead of offering an impossible update.
 * @param {string} name
 * @param {string|undefined} spec
 * @returns {string}
 */
function profileSource(name, spec) {
  if (typeof spec !== 'string') return name
  const trimmed = spec.trim()
  if (trimmed === '' || trimmed === name || trimmed.startsWith(name + '@')) return trimmed === '' ? name : trimmed
  if (/^[\^~*]?\d/.test(trimmed) || /^[<>=]/.test(trimmed) || trimmed === '*' || trimmed === 'latest') {
    return name + '@' + trimmed
  }
  return trimmed
}

/**
 * One inventory plugin entry -> the BundleInfo shape `buildRows` expects.
 * @param {{name: string, version?: string|null, source?: string}} plugin
 * @returns {object}
 */
export function profileBundle(plugin) {
  const name = typeof plugin.name === 'string' ? plugin.name : ''
  return {
    name,
    official: false,
    availability: 'profile',
    version: typeof plugin.version === 'string' && plugin.version !== '' ? plugin.version : null,
    description: '',
    enabled: true,
    installed: true,
    source: profileSource(name, plugin.source),
    optional: false,
    removable: true,
    rows: [],
    overrides: [],
  }
}

/**
 * Every unique plugin name in the inventory, for one registry lookup per name.
 * @param {{profiles?: Array<object>}} payload
 * @returns {string[]}
 */
export function profilePluginNames(payload) {
  const names = new Set()
  const profiles = payload !== null && typeof payload === 'object' && Array.isArray(payload.profiles)
    ? payload.profiles
    : []
  for (const profile of profiles) {
    if (profile === null || typeof profile !== 'object' || !Array.isArray(profile.plugins)) continue
    for (const plugin of profile.plugins) {
      if (plugin !== null && typeof plugin === 'object' && typeof plugin.name === 'string' && plugin.name !== '') {
        names.add(plugin.name)
      }
    }
  }
  return [...names].sort()
}

/**
 * Build one summary per profile for the read-only section.
 * @param {{profiles?: Array<object>}} payload host inventory
 * @param {object} context
 * @param {Record<string, object>} context.manifests package name -> registry latest manifest
 * @param {Record<string, string>} context.errors package name -> lookup error
 * @param {string} [context.runtimeVersion] running DSH version
 * @param {string} [context.localeId] active locale, used for localized titles
 * @param {string} [context.selfName] this plugin's package name
 * @returns {Array<{name: string, rows: Array<object>, updateCount: number, incompatibleCount: number, failedCount: number}>}
 */
export function buildProfileSummaries(payload, context) {
  const settings = context === undefined || context === null ? {} : context
  const current = payload !== null && typeof payload === 'object' && typeof payload.currentProfile === 'string'
    ? payload.currentProfile
    : null
  const profiles = payload !== null && typeof payload === 'object' && Array.isArray(payload.profiles)
    ? payload.profiles
    : []
  const summaries = []
  for (const profile of profiles) {
    if (profile === null || typeof profile !== 'object' || typeof profile.name !== 'string') continue
    if (current !== null && profile.name === current) continue
    const plugins = Array.isArray(profile.plugins) ? profile.plugins : []
    const bundles = plugins.filter((plugin) => plugin !== null && typeof plugin === 'object').map(profileBundle)
    const built = buildRows({
      bundles,
      manifests: settings.manifests,
      errors: settings.errors,
      localeId: settings.localeId,
      runtimeVersion: settings.runtimeVersion,
      selfName: settings.selfName,
    })
    summaries.push({
      name: profile.name,
      rows: built.rows,
      updateCount: built.updateCount,
      incompatibleCount: built.incompatibleCount,
      failedCount: built.failedCount,
    })
  }
  summaries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  return summaries
}

/** Total update count across every other profile. */
export function profileTotalUpdates(summaries) {
  const list = Array.isArray(summaries) ? summaries : []
  return list.reduce((sum, profile) => sum + (typeof profile.updateCount === 'number' ? profile.updateCount : 0), 0)
}
