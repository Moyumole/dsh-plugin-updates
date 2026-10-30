/**
 * Automatic update-check scheduling policy.
 *
 * The plugin checks once when the page loads and on host changes. This module
 * decides when the periodic check that runs while the page is visible is due.
 * It is pure logic so the policy can be unit-tested without a browser: the
 * entry owns the timer and the visibility listeners, this module only answers
 * "should we check now?".
 *
 * Rules:
 * - the interval is 30 minutes;
 * - never start a check while another check or an update is in flight;
 * - a check that has never run is due immediately (fresh page, plugin just
 *   activated, or the first visible tick after a reload);
 * - otherwise the check is due once the last successful check is at least the
 *   interval old.
 *
 * The timer is only alive while the document is visible; returning to the page
 * asks this policy for a catch-up check. Hiding the page clears the timer, so a
 * background tab costs nothing.
 */

/** How often a visible page re-checks; 30 minutes. */
export const AUTO_CHECK_INTERVAL_MS = 30 * 60 * 1000

/**
 * Decide whether a periodic check is due.
 * @param {object} snapshot - the controller snapshot (`phase`, `busyName`, `updatingAll`, `lastCheckedAt`).
 * @param {number} now - current wall-clock time in milliseconds.
 * @returns {boolean} true when the entry may start a check.
 */
export function shouldAutoCheck(snapshot, now) {
  if (snapshot === undefined || snapshot === null || typeof snapshot !== 'object') return false
  if (snapshot.phase === 'checking') return false
  if (snapshot.busyName !== undefined && snapshot.busyName !== null) return false
  if (snapshot.updatingAll === true) return false
  const last = snapshot.lastCheckedAt
  if (typeof last !== 'number' || !isFinite(last)) return true
  return now - last >= AUTO_CHECK_INTERVAL_MS
}
