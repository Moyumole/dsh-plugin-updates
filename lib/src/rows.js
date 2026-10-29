/**
 * Build the update panel's list rows from BundleInfo + registry manifests.
 *
 * Responsibilities:
 * - pick the third-party bundles worth listing (official, missing, not
 *   installed and the panel's own bundle are filtered out);
 * - mark a row `unsupported` when its recorded source is not a plain npm spec
 *   (`file:`, `link:`, `workspace:` ... cannot be updated through the
 *   registry);
 * - mark a row `failed` when the registry lookup failed (reason is the error);
 * - compare the registry `latest` version with the installed version and mark
 *   `update` only when it is strictly newer and compatible with the running
 *   DSH version; incompatible wins over update (requirements are attached);
 * - otherwise mark `latest`.
 *
 * `buildRows` returns rows already ordered for display (see `sortRows`) and the
 * counters the panel badges use. Sorting is deterministic: status order first
 * (update, incompatible, failed, unsupported, latest), then bundle name with
 * plain string comparison.
 *
 * Pure logic only: no DOM, no timers, no Node built-ins.
 */

import { compareVersions, isVersion } from './semver.js'
import { evaluateCompatibility } from './compatibility.js'

/**
 * Row status constants.
 */
export const STATUS = {
  latest: 'latest',
  update: 'update',
  incompatible: 'incompatible',
  failed: 'failed',
  unsupported: 'unsupported',
}

const rowsSortOrder = {
  update: 0,
  incompatible: 1,
  failed: 2,
  unsupported: 3,
  latest: 4,
}
const rowsUnknownSortOrder = 9

/**
 * Resolve a manifest field that is either a plain string or a locale map
 * (`{ en, zh, ... }`) to the best string for `localeId`.
 *
 * @param {*} value
 * @param {string} localeId
 * @returns {string|undefined}
 */
export function pickLocalized(value, localeId) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const chinese = typeof localeId === 'string' && /^zh/i.test(localeId)
  const keys = chinese
    ? [localeId, 'zh', 'zh-CN', 'en']
    : [localeId, 'en', 'zh']
  for (const key of keys) {
    if (typeof key !== 'string') continue
    if (typeof value[key] === 'string' && value[key] !== '') return value[key]
  }
  return undefined
}

/**
 * Whether a BundleInfo represents a third-party bundle installed in the profile
 * and not this plugin itself.
 *
 * @param {object} bundle
 * @param {string} selfName
 * @returns {boolean}
 */
export function isThirdPartyBundle(bundle, selfName) {
  if (!bundle || typeof bundle !== 'object') return false
  if (typeof bundle.name !== 'string' || bundle.name === '') return false
  if (bundle.official === true) return false
  if (bundle.availability !== 'profile') return false
  if (bundle.installed !== true) return false
  if (bundle.name === selfName) return false
  return true
}

/**
 * Whether a bundle's recorded source is a plain npm spec that the registry can
 * update: `name` or `name@version-or-range`.
 *
 * @param {string} source
 * @param {string} name
 * @returns {boolean}
 */
export function isRegistrySource(source, name) {
  if (typeof source !== 'string' || typeof name !== 'string' || name === '') return false
  const trimmed = source.trim()
  if (trimmed === name) return true
  const prefix = name + '@'
  if (!trimmed.startsWith(prefix)) return false
  return trimmed.slice(prefix.length).trim() !== ''
}

function rowsBuildRow(bundle, manifest, error, localeId, runtimeVersion) {
  const name = bundle.name
  const row = {
    name,
    title: pickLocalized(bundle.meta && bundle.meta.title, localeId) || name,
    description: pickLocalized(bundle.meta && bundle.meta.description, localeId)
      || pickLocalized(bundle.description, localeId)
      || '',
    currentVersion: typeof bundle.version === 'string' && bundle.version !== ''
      ? bundle.version
      : null,
    latestVersion: null,
    status: STATUS.latest,
  }
  if (typeof bundle.source === 'string') row.source = bundle.source

  // A registry error always wins: the row shows "check failed" for that package.
  if (typeof error === 'string' && error !== '') {
    row.status = STATUS.failed
    row.reason = error
    return row
  }
  // Without a plain npm source there is no way to update through the registry.
  if (!isRegistrySource(bundle.source, name)) {
    row.status = STATUS.unsupported
    return row
  }
  if (
    !manifest
    || typeof manifest !== 'object'
    || typeof manifest.version !== 'string'
    || manifest.version === ''
  ) {
    // Defensive: a registry source with neither manifest nor error is a failed check.
    row.status = STATUS.failed
    return row
  }
  row.latestVersion = manifest.version
  if (!isVersion(manifest.version) || row.currentVersion === null) {
    row.status = STATUS.latest
    return row
  }
  if (compareVersions(manifest.version, row.currentVersion) <= 0) {
    row.status = STATUS.latest
    return row
  }
  const compatibility = evaluateCompatibility(manifest, runtimeVersion)
  if (compatibility) {
    row.status = STATUS.incompatible
    row.requirements = compatibility.requirements
    return row
  }
  row.status = STATUS.update
  return row
}

/**
 * Order rows for display without mutating the input.
 *
 * Status order: update -> incompatible -> failed -> unsupported -> latest.
 * Ties are broken by bundle name ascending (plain `<` comparison, locale-free).
 *
 * @param {Array<object>} rows
 * @returns {Array<object>}
 */
export function sortRows(rows) {
  const list = Array.isArray(rows) ? rows.slice() : []
  return list.sort((left, right) => {
    const leftOrder = left && rowsSortOrder[left.status]
    const rightOrder = right && rowsSortOrder[right.status]
    const leftRank = typeof leftOrder === 'number' ? leftOrder : rowsUnknownSortOrder
    const rightRank = typeof rightOrder === 'number' ? rightOrder : rowsUnknownSortOrder
    if (leftRank !== rightRank) return leftRank - rightRank
    const leftName = left && typeof left.name === 'string' ? left.name : ''
    const rightName = right && typeof right.name === 'string' ? right.name : ''
    if (leftName === rightName) return 0
    return leftName < rightName ? -1 : 1
  })
}

/**
 * Build the panel rows.
 *
 * @param {object} input
 * @param {Array<object>} input.bundles BundleInfo list from the plugin manager
 * @param {Record<string,object>} input.manifests package-name -> registry latest manifest
 * @param {Record<string,string>} input.errors package-name -> readable lookup error
 * @param {string} input.localeId locale id used for meta title/description
 * @param {string} [input.runtimeVersion] running DSH version
 * @param {string} [input.selfName] the panel's own bundle name (excluded)
 * @returns {{rows:Array<object>, updateCount:number, incompatibleCount:number, failedCount:number}}
 */
export function buildRows({ bundles, manifests, errors, localeId, runtimeVersion, selfName }) {
  const bundleList = Array.isArray(bundles) ? bundles : []
  const manifestMap = manifests && typeof manifests === 'object' ? manifests : {}
  const errorMap = errors && typeof errors === 'object' ? errors : {}
  const rows = []
  for (const bundle of bundleList) {
    if (!isThirdPartyBundle(bundle, selfName)) continue
    rows.push(rowsBuildRow(bundle, manifestMap[bundle.name], errorMap[bundle.name], localeId, runtimeVersion))
  }
  const sorted = sortRows(rows)
  let updateCount = 0
  let incompatibleCount = 0
  let failedCount = 0
  for (const row of sorted) {
    if (row.status === STATUS.update) updateCount += 1
    else if (row.status === STATUS.incompatible) incompatibleCount += 1
    else if (row.status === STATUS.failed) failedCount += 1
  }
  return { rows: sorted, updateCount, incompatibleCount, failedCount }
}
