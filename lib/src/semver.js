/**
 * Version parsing, precedence and npm range matching for the update panel.
 *
 * Responsibilities: the single place that knows semver details — compare the
 * installed version with the registry `latest` version and decide whether a
 * requirement range (`engines.dsh` / `peerDependencies`) accepts the running
 * DSH version.
 *
 * Key semantics (mirrors the `semver` package with `{ includePrerelease: true }`,
 * which is what DSH's boot-time manifest check uses):
 * - strict versions are `x.y.z[-prerelease][+build]`; build metadata never
 *   affects precedence;
 * - invalid versions/ranges never throw here: `parseVersion` -> null and
 *   `satisfies` -> false (callers render a readable state instead);
 * - ranges: `*`/`x`/empty = any, `||` union, comparators `>= > <= < = ^ ~`,
 *   hyphen ranges `a - b`, partial versions (`1`, `1.2`), whitespace =
 *   intersection;
 * - prerelease tags take part in matching instead of being excluded, so a
 *   runtime such as `0.2.1-rc.3` satisfies `^0.2.1-rc.1`; caret/partial ranges
 *   include prereleases at their lower boundary (`^0.2.1` also matches
 *   `0.2.1-rc.3`) exactly like node-semver's includePrerelease expansion.
 *
 * Pure logic only: no DOM, no timers, no Node built-ins. The file is
 * concatenated into the browser bundle, so every helper is `semver*` prefixed
 * and only top-level `export`/single-line imports are used.
 */

const semverVersionPattern =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
const semverRangeVersionPattern =
  /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
const semverNumericPattern = /^(?:0|[1-9]\d*)$/
const semverOperatorPattern = /^(>=|<=|>|<|=|\^|~)\s*(.*)$/
const semverHyphenPattern = /^(\S+)\s+-\s+(\S+)$/

function semverIsValidNumericPart(text) {
  return semverNumericPattern.test(text)
}

function semverIsValidPrereleaseIdentifier(identifier) {
  if (!/^[0-9A-Za-z-]+$/.test(identifier)) return false
  // Numeric prerelease identifiers must not have leading zeroes (semver 2.0.0).
  if (/^\d+$/.test(identifier)) return semverNumericPattern.test(identifier)
  return true
}

/**
 * Parse a strict version string.
 * @param {*} text candidate version
 * @returns {{major:number,minor:number,patch:number,prerelease:string[],build:string[]}|null}
 */
export function parseVersion(text) {
  if (typeof text !== 'string') return null
  const match = semverVersionPattern.exec(text)
  if (!match) return null
  if (!semverIsValidNumericPart(match[1])) return null
  if (!semverIsValidNumericPart(match[2])) return null
  if (!semverIsValidNumericPart(match[3])) return null
  const prerelease = match[4] ? match[4].split('.') : []
  for (const identifier of prerelease) {
    if (!semverIsValidPrereleaseIdentifier(identifier)) return null
  }
  const build = match[5] ? match[5].split('.') : []
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
    build,
  }
}

/**
 * Strict version check: `x.y.z[-prerelease][+build]` only (no `v` prefix).
 * @param {*} text
 * @returns {boolean}
 */
export function isVersion(text) {
  return typeof text === 'string' && parseVersion(text) !== null
}

function semverCoerceParsed(value) {
  if (typeof value === 'string') return parseVersion(value)
  if (
    value && typeof value === 'object'
    && typeof value.major === 'number'
    && typeof value.minor === 'number'
    && typeof value.patch === 'number'
  ) {
    const prerelease = Array.isArray(value.prerelease) ? value.prerelease.map(String) : []
    const build = Array.isArray(value.build) ? value.build.map(String) : []
    return { major: value.major, minor: value.minor, patch: value.patch, prerelease, build }
  }
  return null
}

function semverCompareNumber(left, right) {
  if (left === right) return 0
  return left < right ? -1 : 1
}

function semverComparePrereleaseIdentifier(left, right) {
  const leftNumeric = /^\d+$/.test(left)
  const rightNumeric = /^\d+$/.test(right)
  if (leftNumeric && rightNumeric) {
    return semverCompareNumber(Number(left), Number(right))
  }
  if (leftNumeric) return -1
  if (rightNumeric) return 1
  if (left === right) return 0
  return left < right ? -1 : 1
}

function semverComparePrerelease(left, right) {
  if (left.length === 0 && right.length === 0) return 0
  if (left.length === 0) return 1
  if (right.length === 0) return -1
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const order = semverComparePrereleaseIdentifier(left[index], right[index])
    if (order !== 0) return order
  }
  return semverCompareNumber(left.length, right.length)
}

function semverCompareParsed(left, right) {
  const core = semverCompareNumber(left.major, right.major)
  if (core !== 0) return core
  const minor = semverCompareNumber(left.minor, right.minor)
  if (minor !== 0) return minor
  const patch = semverCompareNumber(left.patch, right.patch)
  if (patch !== 0) return patch
  return semverComparePrerelease(left.prerelease, right.prerelease)
}

/**
 * Compare two versions.
 *
 * Accepts version strings or objects returned by `parseVersion`. Invalid input
 * is unordered and compares equal (0) instead of throwing.
 *
 * @param {string|{major:number,minor:number,patch:number,prerelease?:string[]}} left
 * @param {string|{major:number,minor:number,patch:number,prerelease?:string[]}} right
 * @returns {-1|0|1}
 */
export function compareVersions(left, right) {
  const parsedLeft = semverCoerceParsed(left)
  const parsedRight = semverCoerceParsed(right)
  if (!parsedLeft || !parsedRight) return 0
  return semverCompareParsed(parsedLeft, parsedRight)
}

function semverBoundVersion(major, minor, patch, prerelease) {
  return { major, minor, patch, prerelease: prerelease || [], build: [] }
}

function semverParseRangeVersion(text) {
  if (typeof text !== 'string') return null
  const match = semverRangeVersionPattern.exec(text.trim())
  if (!match) return null
  const rawParts = [match[1], match[2], match[3]]
  const components = [null, null, null]
  let wildcardSeen = false
  for (let index = 0; index < 3; index += 1) {
    const raw = rawParts[index]
    if (raw === undefined || raw === 'x' || raw === 'X' || raw === '*') {
      wildcardSeen = true
      continue
    }
    if (wildcardSeen) continue
    if (!semverIsValidNumericPart(raw)) return null
    components[index] = Number(raw)
  }
  const prerelease = match[4] ? match[4].split('.') : []
  if (prerelease.length > 0) {
    // A prerelease requires a fully specified x.y.z core.
    if (components[0] === null || components[1] === null || components[2] === null) return null
    for (const identifier of prerelease) {
      if (!semverIsValidPrereleaseIdentifier(identifier)) return null
    }
  }
  return {
    major: components[0],
    minor: components[1],
    patch: components[2],
    prerelease,
  }
}

const semverNeverComparators = [
  { op: '<', version: semverBoundVersion(0, 0, 0, ['0']) },
]

function semverCompileCaret(version) {
  const { major, minor, patch, prerelease } = version
  if (major === null) return []
  if (minor === null) {
    return [
      { op: '>=', version: semverBoundVersion(major, 0, 0, ['0']) },
      { op: '<', version: semverBoundVersion(major + 1, 0, 0, ['0']) },
    ]
  }
  if (patch === null) {
    if (major === 0) {
      return [
        { op: '>=', version: semverBoundVersion(0, minor, 0, ['0']) },
        { op: '<', version: semverBoundVersion(0, minor + 1, 0, ['0']) },
      ]
    }
    return [
      { op: '>=', version: semverBoundVersion(major, minor, 0, ['0']) },
      { op: '<', version: semverBoundVersion(major + 1, 0, 0, ['0']) },
    ]
  }
  let upper
  if (major === 0) {
    upper = minor === 0
      ? semverBoundVersion(0, 0, patch + 1, ['0'])
      : semverBoundVersion(0, minor + 1, 0, ['0'])
  } else {
    upper = semverBoundVersion(major + 1, 0, 0, ['0'])
  }
  let lower
  if (prerelease.length > 0) {
    lower = semverBoundVersion(major, minor, patch, prerelease)
  } else {
    // includePrerelease: caret ranges include prereleases at the lower boundary.
    lower = semverBoundVersion(major, minor, patch, major === 0 ? ['0'] : [])
  }
  return [{ op: '>=', version: lower }, { op: '<', version: upper }]
}

function semverCompileTilde(version) {
  const { major, minor, patch, prerelease } = version
  if (major === null) return []
  if (minor === null) {
    return [
      { op: '>=', version: semverBoundVersion(major, 0, 0, []) },
      { op: '<', version: semverBoundVersion(major + 1, 0, 0, ['0']) },
    ]
  }
  if (patch === null) {
    return [
      { op: '>=', version: semverBoundVersion(major, minor, 0, []) },
      { op: '<', version: semverBoundVersion(major, minor + 1, 0, ['0']) },
    ]
  }
  return [
    { op: '>=', version: semverBoundVersion(major, minor, patch, prerelease) },
    { op: '<', version: semverBoundVersion(major, minor + 1, 0, ['0']) },
  ]
}

function semverCompileExact(version) {
  const { major, minor, patch, prerelease } = version
  if (major === null) return []
  if (minor === null) {
    return [
      { op: '>=', version: semverBoundVersion(major, 0, 0, ['0']) },
      { op: '<', version: semverBoundVersion(major + 1, 0, 0, ['0']) },
    ]
  }
  if (patch === null) {
    return [
      { op: '>=', version: semverBoundVersion(major, minor, 0, ['0']) },
      { op: '<', version: semverBoundVersion(major, minor + 1, 0, ['0']) },
    ]
  }
  return [{ op: '=', version: semverBoundVersion(major, minor, patch, prerelease) }]
}

function semverCompileGreater(version) {
  const { major, minor, patch, prerelease } = version
  if (major === null) return semverNeverComparators
  if (minor === null) return [{ op: '>=', version: semverBoundVersion(major + 1, 0, 0, ['0']) }]
  if (patch === null) return [{ op: '>=', version: semverBoundVersion(major, minor + 1, 0, ['0']) }]
  return [{ op: '>', version: semverBoundVersion(major, minor, patch, prerelease) }]
}

function semverCompileGreaterEqual(version) {
  const { major, minor, patch, prerelease } = version
  if (major === null) return []
  if (minor === null) return [{ op: '>=', version: semverBoundVersion(major, 0, 0, ['0']) }]
  if (patch === null) return [{ op: '>=', version: semverBoundVersion(major, minor, 0, ['0']) }]
  return [{ op: '>=', version: semverBoundVersion(major, minor, patch, prerelease) }]
}

function semverCompileLess(version) {
  const { major, minor, patch, prerelease } = version
  if (major === null) return semverNeverComparators
  if (minor === null) return [{ op: '<', version: semverBoundVersion(major, 0, 0, ['0']) }]
  if (patch === null) return [{ op: '<', version: semverBoundVersion(major, minor, 0, ['0']) }]
  return [{ op: '<', version: semverBoundVersion(major, minor, patch, prerelease) }]
}

function semverCompileLessEqual(version) {
  const { major, minor, patch, prerelease } = version
  if (major === null) return []
  if (minor === null) return [{ op: '<', version: semverBoundVersion(major + 1, 0, 0, ['0']) }]
  if (patch === null) return [{ op: '<', version: semverBoundVersion(major, minor + 1, 0, ['0']) }]
  return [{ op: '<=', version: semverBoundVersion(major, minor, patch, prerelease) }]
}

function semverCompileHyphen(fromText, toText) {
  const from = semverParseRangeVersion(fromText)
  const to = semverParseRangeVersion(toText)
  if (!from || !to) return null
  const comparators = []
  if (from.major !== null) {
    let lower
    if (from.minor === null) {
      lower = semverBoundVersion(from.major, 0, 0, ['0'])
    } else if (from.patch === null) {
      lower = semverBoundVersion(from.major, from.minor, 0, ['0'])
    } else if (from.prerelease.length > 0) {
      lower = semverBoundVersion(from.major, from.minor, from.patch, from.prerelease)
    } else {
      lower = semverBoundVersion(from.major, from.minor, from.patch, ['0'])
    }
    comparators.push({ op: '>=', version: lower })
  }
  if (to.major !== null) {
    if (to.minor === null) {
      comparators.push({ op: '<', version: semverBoundVersion(to.major + 1, 0, 0, ['0']) })
    } else if (to.patch === null) {
      comparators.push({ op: '<', version: semverBoundVersion(to.major, to.minor + 1, 0, ['0']) })
    } else if (to.prerelease.length > 0) {
      comparators.push({ op: '<=', version: semverBoundVersion(to.major, to.minor, to.patch, to.prerelease) })
    } else {
      comparators.push({ op: '<', version: semverBoundVersion(to.major, to.minor, to.patch + 1, ['0']) })
    }
  }
  return comparators
}

function semverCompileToken(token) {
  const match = semverOperatorPattern.exec(token)
  const operator = match ? match[1] : ''
  const operand = match ? match[2] : token
  if (operand === '') return null
  const version = semverParseRangeVersion(operand)
  if (!version) return null
  switch (operator) {
    case '^':
      return semverCompileCaret(version)
    case '~':
      return semverCompileTilde(version)
    case '>':
      return semverCompileGreater(version)
    case '>=':
      return semverCompileGreaterEqual(version)
    case '<':
      return semverCompileLess(version)
    case '<=':
      return semverCompileLessEqual(version)
    default:
      return semverCompileExact(version)
  }
}

function semverCompileRange(range) {
  if (typeof range !== 'string') return null
  const trimmed = range.trim()
  if (trimmed === '') return [[]]
  const sets = []
  for (const rawPart of trimmed.split('||')) {
    const part = rawPart.trim()
    if (part === '') return [[]]
    const hyphen = semverHyphenPattern.exec(part)
    if (hyphen) {
      const comparators = semverCompileHyphen(hyphen[1], hyphen[2])
      if (!comparators) return null
      sets.push(comparators)
      continue
    }
    const normalized = part.replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1')
    const comparators = []
    for (const token of normalized.split(/\s+/)) {
      if (token === '') continue
      const compiled = semverCompileToken(token)
      if (!compiled) return null
      for (const comparator of compiled) comparators.push(comparator)
    }
    sets.push(comparators)
  }
  return sets
}

function semverTestComparator(version, comparator) {
  const order = semverCompareParsed(version, comparator.version)
  switch (comparator.op) {
    case '=':
      return order === 0
    case '>':
      return order > 0
    case '>=':
      return order >= 0
    case '<':
      return order < 0
    case '<=':
      return order <= 0
    default:
      return false
  }
}

function semverTestSet(comparators, version) {
  for (const comparator of comparators) {
    if (!semverTestComparator(version, comparator)) return false
  }
  return true
}

/**
 * Whether `version` satisfies `range`, with `{ includePrerelease: true }`
 * semantics (prerelease tags participate in matching).
 *
 * Invalid versions and invalid ranges return `false`; a null/undefined range is
 * invalid. An empty string range means "any", matching the range contract.
 *
 * @param {string|{major:number,minor:number,patch:number,prerelease?:string[]}} version
 * @param {string} range
 * @returns {boolean}
 */
export function satisfies(version, range) {
  const parsedVersion = semverCoerceParsed(version)
  if (!parsedVersion) return false
  const sets = semverCompileRange(range)
  if (!sets) return false
  for (const comparators of sets) {
    if (semverTestSet(comparators, parsedVersion)) return true
  }
  return false
}
