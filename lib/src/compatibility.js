/**
 * Manifest compatibility against the running DSH version.
 *
 * Responsibilities: decide whether the registry `latest` manifest of a plugin
 * may run on this DSH build, following the DSH boot-time rules exactly:
 *
 * 1. a string `engines.dsh` is authoritative and is the only requirement
 *    checked when present;
 * 2. otherwise every `peerDependencies` entry named `@deepseek-ai/dsh` or
 *    starting with `@deepseek-ai/dsh-` is checked;
 * 3. `workspace:^`, `workspace:~` and `workspace:*` count as satisfied;
 * 4. any other range is evaluated with `satisfies(runtime, range)` using
 *    includePrerelease semantics (prerelease runtimes participate);
 * 5. empty or invalid requirement ranges count as unmet, because DSH rejects
 *    such manifests instead of installing them.
 *
 * `evaluateCompatibility` returns `undefined` when the running version is not a
 * valid semver (nothing can be asserted then) or when all requirements pass.
 *
 * Pure logic only: no DOM, no timers, no Node built-ins.
 */

import { isVersion, satisfies } from './semver.js'

const compatWorkspaceRanges = {
  'workspace:^': true,
  'workspace:~': true,
  'workspace:*': true,
}

function compatIsDshPeer(name) {
  return name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')
}

function compatRangeSatisfied(range, runtimeVersion) {
  if (typeof range !== 'string') return false
  const trimmed = range.trim()
  if (trimmed === '') return false
  if (compatWorkspaceRanges[trimmed] === true) return true
  return satisfies(runtimeVersion, trimmed)
}

/**
 * Collect every unmet DSH requirement of `manifest` for `runtimeVersion`.
 *
 * @param {object} manifest registry `/latest` package.json object
 * @param {string} runtimeVersion running DSH version
 * @returns {Record<string,string>} requirement name -> required range; `{}` when satisfied
 */
export function unmetRequirements(manifest, runtimeVersion) {
  const requirements = {}
  if (!manifest || typeof manifest !== 'object') return requirements
  if (!isVersion(runtimeVersion)) return requirements

  const engines = manifest.engines
  if (engines && typeof engines === 'object' && typeof engines.dsh === 'string') {
    if (!compatRangeSatisfied(engines.dsh, runtimeVersion)) {
      requirements['engines.dsh'] = engines.dsh
    }
    return requirements
  }

  const peers = manifest.peerDependencies
  if (!peers || typeof peers !== 'object') return requirements
  for (const name of Object.keys(peers)) {
    if (!compatIsDshPeer(name)) continue
    const range = peers[name]
    if (!compatRangeSatisfied(range, runtimeVersion)) {
      requirements[name] = typeof range === 'string' ? range : String(range)
    }
  }
  return requirements
}

/**
 * Evaluate a candidate manifest against the running DSH version.
 *
 * @param {object} manifest registry `/latest` package.json object
 * @param {string} runtimeVersion running DSH version
 * @returns {undefined|{name:*, version:*, requirements:Record<string,string>}}
 *   undefined when compatible or when the running version cannot be parsed.
 */
export function evaluateCompatibility(manifest, runtimeVersion) {
  if (!isVersion(runtimeVersion)) return undefined
  const requirements = unmetRequirements(manifest, runtimeVersion)
  if (Object.keys(requirements).length === 0) return undefined
  return {
    name: manifest && typeof manifest.name === 'string' ? manifest.name : undefined,
    version: manifest && typeof manifest.version === 'string' ? manifest.version : undefined,
    requirements,
  }
}
