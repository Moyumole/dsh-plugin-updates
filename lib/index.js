/**
 * Host half of dsh-plugin-updates.
 *
 * All work happens in the browser half declared by `dsh.client` in package.json:
 * the panel reads installed bundles through the official plugin manager's Remote
 * methods and performs updates with them. This row exists so the package mounts
 * as a bundle and so the client half has a Loader row to attach to; it keeps no
 * timers, watchers, or services of its own.
 */
export function apply() {}
