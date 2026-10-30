# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-10-30

### Added

- Visible-page auto re-check: while the page is visible the panel re-checks every
  30 minutes (hidden pages pause the timer; returning to the page catches up
  immediately when the result is due, and a reconnect retries a failed check).
  The scheduling policy lives in `lib/src/schedule.js` and is unit-tested.

### Changed

- README/SECURITY now describe the periodic check and its visibility behaviour.

## [0.2.1] - 2026-10-29

First public release (`@moyumole/dsh-plugin-updates`).

### Added

- Right-sidebar Guide card and page tab for plugin updates, with an update badge
  on the Guide capsule and the tab title.
- A global "Plugin updates" tab on the Plugins page, available without an open
  Session.
- A red update badge on the existing left-sidebar "Plugins" icon (the icon keeps
  the host's pinwheel shape and its click still opens the Plugins page).
- Automatic update check on page load, manual refresh, and a 10-minute registry
  cache with npmjs → npmmirror fallback.
- One-click update and update-all through the official plugin manager
  (`removeBundle` → `installBundle(name@latest)`), with an inline confirmation
  and a best-effort rollback to the previous version when the install fails.
- Progress line and progress bar during updates; success/failure/rollback/batch
  toasts in the host's top-center position (auto-dismiss, dismissible).
- DSH-identical compatibility rules (`engines.dsh`, then `@deepseek-ai/dsh*`
  peers, prereleases included) with incompatible versions blocked by default.
- Chinese and English UI copy.

### Security

- No runtime dependencies and no install hooks; `private` removed for the npm
  release but publishing is gated by `prepublishOnly` (bundle-freshness check +
  full test suite).
- Registry package names are validated against the npm grammar and
  percent-encoded before entering a URL; oversized manifests (`Content-Length`
  above 2 MB) are rejected before parsing.
- No `eval`, `new Function`, `innerHTML`, `dangerouslySetInnerHTML`, shell or
  filesystem access in the shipped bundle; the only network endpoints are the two
  npm registries. See `SECURITY.md`.

### Verified

Windows + DSH 0.2.1-rc.3: single updates (`dsh-pet`, `dsh-better-sidebar`,
`dsh-whale-widget`), batch update (`dsh-context` + `dsh-whale-widget`), restart
prompt, and an uninstall that removes every slot registration.
