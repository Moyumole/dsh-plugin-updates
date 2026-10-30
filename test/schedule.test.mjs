import test from 'node:test'
import assert from 'node:assert/strict'

import { AUTO_CHECK_INTERVAL_MS, shouldAutoCheck } from '../lib/src/schedule.js'

const MINUTE = 60 * 1000
const NOW = 1_700_000_000_000

/** A ready snapshot as the controller publishes it. */
function ready(overrides = {}) {
  return {
    phase: 'ready',
    busyName: null,
    updatingAll: false,
    lastCheckedAt: NOW - 1 * MINUTE,
    ...overrides,
  }
}

test('the visible-page check interval is 30 minutes', () => {
  assert.equal(AUTO_CHECK_INTERVAL_MS, 30 * MINUTE)
})

test('a panel that never checked is due immediately', () => {
  assert.equal(shouldAutoCheck(ready({ lastCheckedAt: null }), NOW), true)
  assert.equal(shouldAutoCheck(ready({ lastCheckedAt: undefined }), NOW), true)
})

test('a recent check is not due before the interval', () => {
  assert.equal(shouldAutoCheck(ready({ lastCheckedAt: NOW - 29 * MINUTE }), NOW), false)
  assert.equal(shouldAutoCheck(ready({ lastCheckedAt: NOW - 1 }), NOW), false)
})

test('a check at least one interval old is due', () => {
  assert.equal(shouldAutoCheck(ready({ lastCheckedAt: NOW - 30 * MINUTE }), NOW), true)
  assert.equal(shouldAutoCheck(ready({ lastCheckedAt: NOW - 31 * MINUTE }), NOW), true)
})

test('nothing is due while a check or an update is in flight', () => {
  assert.equal(shouldAutoCheck(ready({ phase: 'checking', lastCheckedAt: null }), NOW), false)
  assert.equal(shouldAutoCheck(ready({ busyName: 'dsh-pet', lastCheckedAt: null }), NOW), false)
  assert.equal(shouldAutoCheck(ready({ updatingAll: true, lastCheckedAt: null }), NOW), false)
})

test('a malformed timeline falls back to "due" and a missing snapshot never is', () => {
  assert.equal(shouldAutoCheck(ready({ lastCheckedAt: NaN }), NOW), true)
  assert.equal(shouldAutoCheck(null, NOW), false)
  assert.equal(shouldAutoCheck(undefined, NOW), false)
})

test('a failed check is retried once due again', () => {
  assert.equal(shouldAutoCheck(ready({ phase: 'failed', lastCheckedAt: NOW - 30 * MINUTE }), NOW), true)
  assert.equal(shouldAutoCheck(ready({ phase: 'failed', lastCheckedAt: NOW - 1 * MINUTE }), NOW), false)
})
