import test from 'node:test'
import assert from 'node:assert/strict'

import { compareVersions, isVersion, parseVersion, satisfies } from '../lib/src/semver.js'

test('parseVersion parses strict versions, prerelease and build metadata', () => {
  assert.deepEqual(parseVersion('1.2.3'), {
    major: 1, minor: 2, patch: 3, prerelease: [], build: [],
  })
  assert.deepEqual(parseVersion('0.2.1-rc.3'), {
    major: 0, minor: 2, patch: 1, prerelease: ['rc', '3'], build: [],
  })
  assert.deepEqual(parseVersion('1.0.0-alpha.1+build.5'), {
    major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'], build: ['build', '5'],
  })
})

test('parseVersion rejects malformed input without throwing', () => {
  const invalid = [
    '', '1', '1.2', '1.2.3.4', 'v1.2.3', '01.2.3', '1.02.3', '1.2.03',
    '1.2.3-', '1.2.3-01', '1.2.3-rc..1', '1.2.3+', 'x.y.z', ' 1.2.3',
    null, undefined, 42, {},
  ]
  for (const input of invalid) {
    assert.equal(parseVersion(input), null, `expected null for ${String(input)}`)
  }
})

test('isVersion is strict x.y.z[-pre][+build]', () => {
  assert.equal(isVersion('1.2.3'), true)
  assert.equal(isVersion('1.2.3-rc.1'), true)
  assert.equal(isVersion('1.2.3+build'), true)
  assert.equal(isVersion('1.2'), false)
  assert.equal(isVersion('v1.2.3'), false)
  assert.equal(isVersion(''), false)
  assert.equal(isVersion(null), false)
})

test('compareVersions orders core versions and ignores build metadata', () => {
  assert.equal(compareVersions('1.2.3', '1.2.4'), -1)
  assert.equal(compareVersions('2.0.0', '1.9.9'), 1)
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0)
  assert.equal(compareVersions('1.2.3+a', '1.2.3+b'), 0)
  assert.equal(compareVersions('1.2.3', '1.2.3-rc.1'), 1)
  assert.equal(compareVersions('1.2.3-rc.1', '1.2.3'), -1)
})

test('compareVersions follows semver prerelease precedence', () => {
  const ordered = [
    '1.0.0-alpha',
    '1.0.0-alpha.1',
    '1.0.0-alpha.beta',
    '1.0.0-beta',
    '1.0.0-beta.2',
    '1.0.0-beta.11',
    '1.0.0-rc.1',
    '1.0.0',
  ]
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]
    const current = ordered[index]
    assert.equal(compareVersions(previous, current), -1, `${previous} < ${current}`)
    assert.equal(compareVersions(current, previous), 1, `${current} > ${previous}`)
  }
})

test('compareVersions accepts parsed versions and tolerates invalid input', () => {
  assert.equal(compareVersions(parseVersion('0.2.1-rc.3'), '0.2.1-rc.3'), 0)
  assert.equal(compareVersions('1.2.3', parseVersion('1.2.4')), -1)
  assert.equal(compareVersions('not-a-version', '1.0.0'), 0)
  assert.equal(compareVersions(null, undefined), 0)
})

test('satisfies matches the real DSH peer/engine ranges (includePrerelease)', () => {
  // dsh-better-sidebar peerDependencies
  assert.equal(satisfies('0.2.1-rc.3', '^0.2.1-rc.1'), true)
  assert.equal(satisfies('0.3.0', '^0.2.1-rc.1'), false)
  // dsh-context engines.dsh
  assert.equal(satisfies('0.2.1-rc.3', '>=0.2.0-rc.2 || >=0.2.1-rc.2'), true)
  // dsh-pet peerDependencies
  assert.equal(satisfies('0.2.1-rc.3', '^0.2.0-rc.1'), true)
  // a stable runtime also satisfies ranges that opted into rc
  assert.equal(satisfies('0.2.1', '^0.2.1-rc.1'), true)
})

test('satisfies includes prerelease tags instead of excluding them', () => {
  assert.equal(satisfies('0.2.1-rc.3', '^0.2.1'), true)
  assert.equal(satisfies('0.2.1-rc.3', '>=0.2.0'), true)
  assert.equal(satisfies('1.2.3-rc.1', '*'), true)
  assert.equal(satisfies('0.2.0-rc.1', '>=0.2.0-rc.2 || >=0.2.1-rc.2'), false)
})

test('satisfies handles stars, empty ranges and partial versions', () => {
  for (const range of ['*', 'x', 'X', '']) {
    assert.equal(satisfies('1.2.3', range), true, `range ${JSON.stringify(range)}`)
  }
  assert.equal(satisfies('1.9.0', '1'), true)
  assert.equal(satisfies('2.0.0', '1'), false)
  assert.equal(satisfies('1.2.9', '1.2'), true)
  assert.equal(satisfies('1.3.0', '1.2'), false)
  assert.equal(satisfies('1.2.9', '1.2.x'), true)
  assert.equal(satisfies('1.3.0', '1.2.x'), false)
  assert.equal(satisfies('1.2.9', '1.x'), true)
  assert.equal(satisfies('2.0.0', '1.x'), false)
})

test('satisfies handles comparators, caret and tilde', () => {
  assert.equal(satisfies('1.2.3', '>=1.2.3'), true)
  assert.equal(satisfies('1.2.2', '>=1.2.3'), false)
  assert.equal(satisfies('1.2.3', '>1.2.3'), false)
  assert.equal(satisfies('1.2.4', '>1.2.3'), true)
  assert.equal(satisfies('1.2.3', '<=1.2.3'), true)
  assert.equal(satisfies('1.2.4', '<=1.2.3'), false)
  assert.equal(satisfies('1.2.3', '<1.2.4'), true)
  assert.equal(satisfies('1.2.4', '<1.2.4'), false)
  assert.equal(satisfies('1.2.3', '=1.2.3'), true)
  assert.equal(satisfies('1.2.3', '= 1.2.3'), true)
  assert.equal(satisfies('1.2.4', '^1.2.3'), true)
  assert.equal(satisfies('2.0.0', '^1.2.3'), false)
  assert.equal(satisfies('0.2.2', '^0.2.1'), true)
  assert.equal(satisfies('0.3.0', '^0.2.1'), false)
  assert.equal(satisfies('0.0.2', '^0.0.1'), false)
  assert.equal(satisfies('1.2.9', '~1.2.3'), true)
  assert.equal(satisfies('1.3.0', '~1.2.3'), false)
  assert.equal(satisfies('0.2.2', '~0.2.1'), true)
  assert.equal(satisfies('0.2.9', '~0.2.1'), true)
  assert.equal(satisfies('0.3.0', '~0.2.1'), false)
  assert.equal(satisfies('1.5.0', '>=1.0.0 <2.0.0'), true)
  assert.equal(satisfies('2.0.0', '>=1.0.0 <2.0.0'), false)
  assert.equal(satisfies('1.0.0', '>=1.0.0 || <0.5.0'), true)
  assert.equal(satisfies('0.4.0', '>=1.0.0 || <0.5.0'), true)
  assert.equal(satisfies('0.6.0', '>=1.0.0 || <0.5.0'), false)
})

test('satisfies handles hyphen ranges', () => {
  assert.equal(satisfies('1.5.0', '1.2.3 - 2.3.4'), true)
  assert.equal(satisfies('2.3.4', '1.2.3 - 2.3.4'), true)
  assert.equal(satisfies('1.2.2', '1.2.3 - 2.3.4'), false)
  assert.equal(satisfies('2.3.5', '1.2.3 - 2.3.4'), false)
  assert.equal(satisfies('1.2.9', '1.2 - 1.3'), true)
  assert.equal(satisfies('1.4.0', '1.2 - 1.3'), false)
  assert.equal(satisfies('2.0.0', '1 - 2'), true)
  assert.equal(satisfies('3.0.0', '1 - 2'), false)
})

test('satisfies returns false for invalid versions and ranges', () => {
  assert.equal(satisfies('', '*'), false)
  assert.equal(satisfies('not-a-version', '*'), false)
  assert.equal(satisfies('1.2.3', 'not-a-range'), false)
  assert.equal(satisfies('1.2.3', '>=abc'), false)
  assert.equal(satisfies('1.2.3', '>='), false)
  assert.equal(satisfies('1.2.3', '1.2.3 - '), false)
  assert.equal(satisfies('1.2.3', '1.2.3.4'), false)
  assert.equal(satisfies('1.2.3', null), false)
  assert.equal(satisfies('1.2.3', 42), false)
})
